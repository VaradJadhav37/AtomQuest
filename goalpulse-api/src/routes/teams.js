const express = require('express');
const { supabase } = require('../db');
const { requireAuth } = require('./auth');
const { publishEvent } = require('../services/realtime');

const router = express.Router();

function isAdmin(user) {
  return user?.role === 'ADMIN';
}

function isManager(user) {
  return user?.role === 'MANAGER';
}

async function logTeamEvent({ userId, action, entity, entityId, detail }) {
  const payload = {
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
  };
  await supabase.from('audit_log').insert(payload);
  publishEvent({ type: 'AUDIT_EVENT', user_id: userId, action, entity, entity_id: entityId });
}

function sanitizeText(value, maxLen = 500) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLen);
}

async function notifyTeamMembers(teamId, title, message, actorId, payload = {}) {
  const { data: rows } = await supabase
    .from('team_members')
    .select('employee_id')
    .eq('team_id', teamId)
    .eq('status', 'active');
  const recipients = [...new Set((rows || []).map(r => Number(r.employee_id)).filter(Boolean))];
  if (!recipients.length) return;
  await supabase.from('notifications').insert(
    recipients.map(user_id => ({
      user_id,
      category: 'TEAM_GOAL',
      title,
      message,
      payload: { ...payload, actor_id: actorId, team_id: teamId },
    }))
  );
  recipients.forEach(userId => publishEvent({ type: 'NOTIFICATION', user_id: userId, title, message, payload }));
}

async function getTeam(teamId) {
  const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getUsersByIds(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean).map(id => Number(id)))];
  if (!uniqueIds.length) return [];
  const baseColumns = 'id, name, email, role, department, manager_id, created_at';
  const withIsActiveColumns = `${baseColumns}, is_active`;
  const { data, error } = await supabase.from('users').select(withIsActiveColumns).in('id', uniqueIds);
  if (!error) return data || [];

  if (String(error.message || '').includes('column users.is_active does not exist')) {
    const { data: fallbackData, error: fallbackError } = await supabase.from('users').select(baseColumns).in('id', uniqueIds);
    if (fallbackError) throw fallbackError;
    return (fallbackData || []).map(user => ({ ...user, is_active: true }));
  }

  throw error;
}

async function getTeamMembers(teamId, status = 'active') {
  const query = supabase.from('team_members').select('*').eq('team_id', teamId);
  if (status) query.eq('status', status);
  const { data, error } = await query.order('joined_at', { ascending: true });
  if (error) throw error;
  const members = data || [];
  const users = await getUsersByIds(members.map(member => member.employee_id));
  const userMap = new Map(users.map(user => [Number(user.id), user]));
  return members.map(member => ({
    ...member,
    employee: userMap.get(Number(member.employee_id)) || null,
  }));
}

async function getTeamRequests(teamId, status = 'pending') {
  const query = supabase.from('team_join_requests').select('*').eq('team_id', teamId);
  if (status) query.eq('status', status);
  const { data, error } = await query.order('requested_at', { ascending: false });
  if (error) throw error;
  const requests = data || [];
  const users = await getUsersByIds(requests.map(request => request.employee_id));
  const reviewers = await getUsersByIds(requests.map(request => request.reviewed_by));
  const userMap = new Map(users.map(user => [Number(user.id), user]));
  const reviewerMap = new Map(reviewers.map(user => [Number(user.id), user]));
  return requests.map(request => ({
    ...request,
    employee: userMap.get(Number(request.employee_id)) || null,
    reviewer: reviewerMap.get(Number(request.reviewed_by)) || null,
  }));
}

async function assertTeamAccess(req, team) {
  if (!team) return false;
  if (isAdmin(req.user)) return true;
  if (isManager(req.user) && Number(team.manager_id) === Number(req.user.id)) return true;
  if (req.user?.role === 'EMPLOYEE') {
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team.id)
      .eq('employee_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle();
    return !!membership;
  }
  return false;
}

async function getOwnedTeams(user) {
  const query = user.role === 'ADMIN'
    ? supabase.from('teams').select('*').eq('is_active', true)
    : supabase.from('teams').select('*').eq('manager_id', user.id).eq('is_active', true);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function enrichTeams(teams) {
  const allTeamIds = teams.map(team => team.id);
  if (!allTeamIds.length) return teams;

  // Fetch members and goals in parallel
  const [{ data: memberRows }, { data: rawGoals }] = await Promise.all([
    supabase.from('team_members').select('team_id, employee_id, status').in('team_id', allTeamIds).eq('status', 'active'),
    supabase.from('goals').select('id, team_id').in('team_id', allTeamIds),
  ]);

  const goals = rawGoals || [];
  const goalIds = goals.map(g => g.id);

  // Achievements depend on goal IDs — fetch after
  const { data: rawAchievements } = goalIds.length
    ? await supabase.from('goal_achievements').select('goal_id, score').in('goal_id', goalIds)
    : { data: [] };
  const achievements = rawAchievements || [];

  return teams.map(team => {
    const teamMemberCount = (memberRows || []).filter(m => Number(m.team_id) === Number(team.id)).length;
    const teamGoals = goals.filter(g => Number(g.team_id) === Number(team.id));
    const teamGoalIds = new Set(teamGoals.map(g => g.id));
    const teamScores = achievements
      .filter(a => teamGoalIds.has(a.goal_id) && a.score != null)
      .map(a => Number(a.score || 0));
    const avgProgress = teamScores.length
      ? Math.round((teamScores.reduce((s, v) => s + v, 0) / teamScores.length) * 10) / 10
      : 0;
    return { ...team, member_count: teamMemberCount, goal_count: teamGoals.length, avg_progress: avgProgress };
  });
}


async function ensureUniqueTeamName(managerId, name, teamIdToIgnore = null) {
  const query = supabase.from('teams').select('id').eq('manager_id', managerId).eq('name', name);
  if (teamIdToIgnore) query.neq('id', teamIdToIgnore);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return !data;
}

// GET /api/teams
router.get('/', requireAuth, async (req, res) => {
  try {
    const teams = await enrichTeams(await getOwnedTeams(req.user));
    res.json({ teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/available
router.get('/available', requireAuth, async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, description, manager_id, created_at, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const activeMemberships = req.user.role === 'EMPLOYEE'
      ? (await supabase.from('team_members').select('team_id').eq('employee_id', req.user.id).eq('status', 'active')).data || []
      : [];
    const pendingRequests = req.user.role === 'EMPLOYEE'
      ? (await supabase.from('team_join_requests').select('team_id').eq('employee_id', req.user.id).eq('status', 'pending')).data || []
      : [];
    const excludedTeamIds = new Set([...activeMemberships, ...pendingRequests].map(row => Number(row.team_id)));
    const filtered = (teams || []).filter(team => !excludedTeamIds.has(Number(team.id)));
    const managers = await getUsersByIds(filtered.map(team => team.manager_id));
    const managerMap = new Map(managers.map(user => [Number(user.id), user]));

    res.json({
      teams: filtered.map(team => ({
        ...team,
        manager: managerMap.get(Number(team.manager_id)) || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/mine
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const memberships = (await supabase.from('team_members').select('*').eq('employee_id', req.user.id).order('joined_at', { ascending: false })).data || [];
    const requests = (await supabase.from('team_join_requests').select('*').eq('employee_id', req.user.id).order('requested_at', { ascending: false })).data || [];
    const teamRows = memberships.length
      ? (await supabase.from('teams').select('id, name, description, manager_id, created_at, is_active').in('id', memberships.map(item => item.team_id))).data || []
      : [];
    
    // Enrich teams with goal count and progress
    const enrichedTeams = await enrichTeams(teamRows);
    
    const managerRows = await getUsersByIds(teamRows.map(team => team.manager_id));
    const managerMap = new Map(managerRows.map(user => [Number(user.id), user]));
    const teamMap = new Map(enrichedTeams.map(team => [Number(team.id), team]));

    res.json({
      memberships: memberships.map(membership => ({
        ...membership,
        team: {
          ...teamMap.get(Number(membership.team_id)),
          manager: managerMap.get(Number(teamMap.get(Number(membership.team_id))?.manager_id)) || null,
        },
      })),
      requests: requests.map(request => ({
        ...request,
        team: teamMap.get(Number(request.team_id)) || null,
      })),
      activeTeams: enrichedTeams.map(team => ({
        ...team,
        manager: managerMap.get(Number(team.manager_id)) || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams
router.post('/', requireAuth, async (req, res) => {
  try {
    if (!['MANAGER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only managers and admins can create teams' });
    }

    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const managerId = req.user.role === 'ADMIN' && req.body.manager_id ? Number(req.body.manager_id) : Number(req.user.id);

    // Ensure the manager exists to avoid a foreign-key violation on insert
    const managerRows = await getUsersByIds([managerId]);
    if (!managerRows || !managerRows.length) {
      return res.status(400).json({ error: 'Invalid manager_id; referenced user does not exist' });
    }

    if (!name) return res.status(400).json({ error: 'Team name is required' });
    if (!(await ensureUniqueTeamName(managerId, name))) {
      return res.status(400).json({ error: 'A team with that name already exists for this manager' });
    }

    const { data: team, error } = await supabase.from('teams').insert({
      name,
      description,
      manager_id: managerId,
      is_active: true,
    }).select().single();
    if (error) throw error;

    await logTeamEvent({
      userId: req.user.id,
      action: 'TEAM_EVENT',
      entity: 'team',
      entityId: team.id,
      detail: { note: `Created team ${name}`, after: team },
    });

    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:teamId
router.get('/:teamId', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });

    const members = await getTeamMembers(team.id, 'active');
    const pendingRequests = await getTeamRequests(team.id, 'pending');

    res.json({
      team,
      members,
      pendingRequests,
      pendingCount: pendingRequests.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/teams/:teamId
router.patch('/:teamId', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });

    const updates = {};
    if (req.body.name !== undefined) {
      const nextName = String(req.body.name || '').trim();
      if (!nextName) return res.status(400).json({ error: 'Team name cannot be empty' });
      if (!(await ensureUniqueTeamName(team.manager_id, nextName, team.id))) {
        return res.status(400).json({ error: 'A team with that name already exists for this manager' });
      }
      updates.name = nextName;
    }
    if (req.body.description !== undefined) updates.description = String(req.body.description || '').trim();

    const { data: updated, error } = await supabase.from('teams').update(updates).eq('id', team.id).select().single();
    if (error) throw error;

    await logTeamEvent({
      userId: req.user.id,
      action: 'TEAM_EVENT',
      entity: 'team',
      entityId: team.id,
      detail: { note: `Updated team ${team.name}`, before: team, after: updated },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:teamId
router.delete('/:teamId', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });

    const { data: updated, error } = await supabase.from('teams').update({ is_active: false }).eq('id', team.id).select().single();
    if (error) throw error;

    await logTeamEvent({
      userId: req.user.id,
      action: 'TEAM_EVENT',
      entity: 'team',
      entityId: team.id,
      detail: { note: `Deactivated team ${team.name}`, before: team, after: updated },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:teamId/members
router.get('/:teamId/members', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });

    const members = await getTeamMembers(team.id, 'active');
    res.json({ team, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:teamId/goals
router.get('/:teamId/goals', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });

    const q = String(req.query.q || '').trim().toLowerCase();
    const ownerId = req.query.owner_id ? Number(req.query.owner_id) : null;
    const checkinStatus = req.query.status ? String(req.query.status).toUpperCase() : null;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const { data: goals, error } = await supabase
      .from('goals')
      .select('id, goal_sheet_id, team_id, owner_id, title, uom_type, target_value, weightage, thrust_area, description, created_at, priority, goal_status, visibility, deadline, completion_pct, blocked_reason, archived_at')
      .eq('team_id', team.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const sheets = goals?.length
      ? (await supabase.from('goal_sheets').select('id, employee_id, cycle_id, status').in('id', goals.map(goal => goal.goal_sheet_id))).data || []
      : [];
    const users = await getUsersByIds(sheets.map(sheet => sheet.employee_id));
    const userMap = new Map(users.map(user => [Number(user.id), user]));
    const sheetMap = new Map(sheets.map(sheet => [Number(sheet.id), sheet]));
    const goalIds = (goals || []).map(goal => goal.id);
    const achievements = goalIds.length
      ? (await supabase.from('goal_achievements').select('goal_id, cycle_id, actual_value, score').in('goal_id', goalIds)).data || []
      : [];
    const checkins = goalIds.length
      ? (await supabase.from('check_ins').select('goal_id, cycle_id, status, employee_comment, manager_comment').in('goal_id', goalIds)).data || []
      : [];
    const milestones = goalIds.length
      ? (await supabase.from('team_goal_milestones').select('id, goal_id, milestone_status, progress_pct').in('goal_id', goalIds)).data || []
      : [];
    const contributions = goalIds.length
      ? (await supabase.from('team_goal_contributions').select('id, goal_id, member_id, contribution_pct').in('goal_id', goalIds)).data || []
      : [];

    let enrichedGoals = (goals || []).map(goal => {
      const sheet = sheetMap.get(Number(goal.goal_sheet_id)) || null;
      const employee = sheet ? userMap.get(Number(sheet.employee_id)) || null : null;
      const achievement = achievements.find(item => Number(item.goal_id) === Number(goal.id) && Number(item.cycle_id) === Number(sheet?.cycle_id)) || null;
      const checkin = checkins.find(item => Number(item.goal_id) === Number(goal.id) && Number(item.cycle_id) === Number(sheet?.cycle_id)) || null;
      return {
        ...goal,
        employee,
        sheet,
        achievement,
        checkin,
        milestones: milestones.filter(m => Number(m.goal_id) === Number(goal.id)),
        contributions: contributions.filter(c => Number(c.goal_id) === Number(goal.id)),
      };
    });

    if (ownerId) enrichedGoals = enrichedGoals.filter(goal => Number(goal.employee?.id) === ownerId);
    if (checkinStatus) enrichedGoals = enrichedGoals.filter(goal => String(goal.checkin?.status || 'NOT_STARTED').toUpperCase() === checkinStatus);
    if (q) enrichedGoals = enrichedGoals.filter(goal =>
      String(goal.title || '').toLowerCase().includes(q) ||
      String(goal.description || '').toLowerCase().includes(q) ||
      String(goal.thrust_area || '').toLowerCase().includes(q) ||
      String(goal.employee?.name || '').toLowerCase().includes(q)
    );

    const total = enrichedGoals.length;
    const paged = enrichedGoals.slice(offset, offset + limit);
    res.json({
      team,
      goals: paged,
      pagination: { total, limit, offset, has_more: offset + limit < total },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:teamId/goals — create a team-scoped goal
router.post('/:teamId/goals', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });

    // Access: managers/admins own the team; employees must be active members
    const isManagerOrAdmin = req.user.role === 'ADMIN' || (req.user.role === 'MANAGER' && Number(team.manager_id) === Number(req.user.id));
    if (!isManagerOrAdmin) {
      const { data: membership } = await supabase
        .from('team_members').select('id').eq('team_id', team.id).eq('employee_id', req.user.id).eq('status', 'active').maybeSingle();
      if (!membership) return res.status(403).json({ error: 'You are not an active member of this team' });
    }

    const { title, uom_type, target_value, weightage, thrust_area, description, priority, visibility, deadline, goal_status, owner_id } = req.body;
    if (!title || !uom_type || target_value == null || weightage == null) {
      return res.status(400).json({ error: 'title, uom_type, target_value and weightage are required' });
    }
    if (String(title).length > 200) return res.status(400).json({ error: 'Title must be 200 characters or fewer' });
    if (description && String(description).length > 1000) return res.status(400).json({ error: 'Description must be 1000 characters or fewer' });

    const weight = Number(weightage);
    const MIN_W = 10;
    const MAX_GOALS = 8;
    if (isNaN(weight) || weight < MIN_W) return res.status(400).json({ error: `Minimum weightage per goal is ${MIN_W}%` });

    // Get active cycle

    const { data: cycle } = await supabase.from('cycles').select('*').eq('status', 'OPEN')
      .order('year', { ascending: false }).limit(1).maybeSingle();
    if (!cycle) return res.status(400).json({ error: 'No active cycle found' });

    // Determine target owner for goal (must be active member of team, or the manager, or the current user)
    const targetOwnerId = (isManagerOrAdmin && owner_id) ? Number(owner_id) : req.user.id;
    if (targetOwnerId !== req.user.id) {
      const { data: membership } = await supabase
        .from('team_members').select('id').eq('team_id', team.id).eq('employee_id', targetOwnerId).eq('status', 'active').maybeSingle();
      if (!membership && targetOwnerId !== Number(team.manager_id)) {
        return res.status(403).json({ error: 'Assignee is not an active member of this team' });
      }
    }

    // Find or create the target owner's goal sheet for this cycle
    const { data: existingSheet } = await supabase.from('goal_sheets')
      .select('*').eq('employee_id', targetOwnerId).eq('cycle_id', cycle.id).maybeSingle();
    let sheet = existingSheet;
    if (!sheet) {
      const { data: newSheet, error: sheetErr } = await supabase.from('goal_sheets')
        .insert({ employee_id: targetOwnerId, cycle_id: cycle.id, status: 'DRAFT' }).select().single();
      if (sheetErr) throw sheetErr;
      sheet = newSheet;
    }

    if (['APPROVED', 'PENDING_APPROVAL'].includes(sheet.status)) {
      return res.status(403).json({ error: "Assignee's goal sheet is locked — cannot add goals" });
    }

    const { data: existingGoals } = await supabase.from('goals').select('id, weightage, team_id').eq('goal_sheet_id', sheet.id);
    const goalList = existingGoals || [];
    if (goalList.length >= MAX_GOALS) return res.status(400).json({ error: `Maximum ${MAX_GOALS} goals per sheet` });
    // Only check against the team goal pool (separate 100% budget from individual goals)
    const teamGoalPool = goalList.filter(g => g.team_id != null);
    const currentTeamTotal = teamGoalPool.reduce((s, g) => s + Number(g.weightage || 0), 0);
    if (currentTeamTotal + weight > 100) {
      return res.status(400).json({ error: `Team goal weightage would exceed 100% on assignee's team pool (current: ${currentTeamTotal}%)` });
    }

    const normalizedUom = ['Numeric', 'Percentage', 'Timeline', 'Zero'].includes(uom_type) ? uom_type : 'Numeric';
    const normalizedPriority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(priority || '').toUpperCase()) ? String(priority).toUpperCase() : 'MEDIUM';
    const normalizedStatus = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED'].includes(String(goal_status || '').toUpperCase()) ? String(goal_status).toUpperCase() : 'NOT_STARTED';
    const normalizedVisibility = ['TEAM', 'MANAGER_ONLY', 'PRIVATE'].includes(String(visibility || '').toUpperCase()) ? String(visibility).toUpperCase() : 'TEAM';
    const { data: goal, error: goalErr } = await supabase.from('goals').insert({
      goal_sheet_id: sheet.id,
      team_id: team.id,
      owner_id: targetOwnerId,
      title: String(title).trim(),
      uom_type: normalizedUom,
      target_value: String(target_value).trim(),
      weightage: weight,
      thrust_area: thrust_area || 'General',
      description: description ? sanitizeText(description, 1000) : '',
      priority: normalizedPriority,
      goal_status: normalizedStatus,
      visibility: normalizedVisibility,
      deadline: deadline || null,
    }).select().single();
    if (goalErr) throw goalErr;


    await logTeamEvent({ userId: req.user.id, action: 'TEAM_GOAL_CREATED', entity: 'goal', entityId: goal.id,
      detail: { note: `Team goal created: ${title}`, team_id: team.id, after: goal } });
    await supabase.from('goal_activity_log').insert({
      goal_id: goal.id,
      team_id: team.id,
      actor_id: req.user.id,
      activity_type: 'GOAL_CREATED',
      detail: { title: goal.title, weightage: goal.weightage, priority: goal.priority },
    });
    await notifyTeamMembers(team.id, 'New team goal', `${req.user.name || 'A teammate'} created "${goal.title}"`, req.user.id, { goal_id: goal.id });

    res.status(201).json(goal);
  } catch (err) {
    console.error('POST /:teamId/goals:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/teams/:teamId/goals/:goalId — edit a team goal
router.patch('/:teamId/goals/:goalId', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });

    const { data: goal } = await supabase.from('goals').select('*, goal_sheets(*)').eq('id', req.params.goalId).maybeSingle();
    if (!goal || Number(goal.team_id) !== Number(team.id)) return res.status(404).json({ error: 'Goal not found in this team' });

    // Only the owner of the sheet (or manager/admin) can edit
    const sheet = goal.goal_sheets;
    const isOwner = Number(sheet?.employee_id) === Number(req.user.id);
    const isManagerOrAdmin = req.user.role === 'ADMIN' || (req.user.role === 'MANAGER' && Number(team.manager_id) === Number(req.user.id));
    if (!isOwner && !isManagerOrAdmin) return res.status(403).json({ error: 'You can only edit your own team goals' });
    if (sheet && ['APPROVED', 'PENDING_APPROVAL'].includes(sheet.status)) {
      return res.status(403).json({ error: 'Goal sheet is locked — cannot edit goals' });
    }

    const updates = {};

    // Handle assignee (owner_id) change
    if (req.body.owner_id !== undefined && isManagerOrAdmin) {
      const nextOwnerId = Number(req.body.owner_id);
      if (nextOwnerId !== goal.owner_id) {
        // Ensure new owner is active member of team
        const { data: membership } = await supabase
          .from('team_members').select('id').eq('team_id', team.id).eq('employee_id', nextOwnerId).eq('status', 'active').maybeSingle();
        if (!membership && nextOwnerId !== Number(team.manager_id)) {
          return res.status(403).json({ error: 'New assignee must be an active member of this team' });
        }
        
        // Find or create sheet for new owner
        const { data: newSheet } = await supabase.from('goal_sheets')
          .select('*').eq('employee_id', nextOwnerId).eq('cycle_id', goal.goal_sheets.cycle_id).maybeSingle();
        let targetSheet = newSheet;
        if (!targetSheet) {
          const { data: createdSheet, error: sheetErr } = await supabase.from('goal_sheets')
            .insert({ employee_id: nextOwnerId, cycle_id: goal.goal_sheets.cycle_id, status: 'DRAFT' }).select().single();
          if (sheetErr) throw sheetErr;
          targetSheet = createdSheet;
        }
        if (['APPROVED', 'PENDING_APPROVAL'].includes(targetSheet.status)) {
          return res.status(403).json({ error: "New assignee's goal sheet is locked" });
        }
        
        // Validate capacity on new sheet — check team pool only
        const { data: newSheetGoals } = await supabase.from('goals').select('id, weightage, team_id').eq('goal_sheet_id', targetSheet.id);
        const newSheetGoalList = newSheetGoals || [];
        const MAX_GOALS = 8;
        if (newSheetGoalList.length >= MAX_GOALS) return res.status(400).json({ error: 'New assignee already has maximum goals' });
        const newSheetTeamPool = newSheetGoalList.filter(g => g.team_id != null);
        const newSheetTeamTotal = newSheetTeamPool.reduce((s, g) => s + Number(g.weightage || 0), 0);
        const goalWeight = req.body.weightage !== undefined ? Number(req.body.weightage) : goal.weightage;
        if (newSheetTeamTotal + goalWeight > 100) {
          return res.status(400).json({ error: `Team goal weightage would exceed 100% on new assignee's team pool (current: ${newSheetTeamTotal}%)` });
        }
        
        updates.goal_sheet_id = targetSheet.id;
        updates.owner_id = nextOwnerId;
      }
    }

    if (req.body.title !== undefined) {
      if (String(req.body.title).length > 200) return res.status(400).json({ error: 'Title too long' });
      const nextTitle = String(req.body.title).trim();
      if (!nextTitle) return res.status(400).json({ error: 'Title cannot be empty' });
      updates.title = nextTitle;
    }
    if (req.body.description !== undefined) {
      if (String(req.body.description).length > 1000) return res.status(400).json({ error: 'Description too long' });
      updates.description = sanitizeText(req.body.description, 1000);
    }
    if (req.body.target_value !== undefined) {
      const nextTarget = String(req.body.target_value).trim();
      if (!nextTarget) return res.status(400).json({ error: 'Target value cannot be empty' });
      if (nextTarget.length > 100) return res.status(400).json({ error: 'Target value must be 100 characters or fewer' });
      updates.target_value = nextTarget;
    }
    if (req.body.thrust_area !== undefined) updates.thrust_area = String(req.body.thrust_area).trim();
    if (req.body.priority !== undefined) {
      const nextPriority = String(req.body.priority).toUpperCase();
      if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(nextPriority)) return res.status(400).json({ error: 'Invalid priority' });
      updates.priority = nextPriority;
    }
    if (req.body.goal_status !== undefined) {
      const nextStatus = String(req.body.goal_status).toUpperCase();
      if (!['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED'].includes(nextStatus)) return res.status(400).json({ error: 'Invalid goal_status' });
      updates.goal_status = nextStatus;
      if (nextStatus === 'ARCHIVED') updates.archived_at = new Date().toISOString();
      if (nextStatus !== 'BLOCKED') updates.blocked_reason = '';
    }
    if (req.body.blocked_reason !== undefined) updates.blocked_reason = sanitizeText(req.body.blocked_reason, 500);
    if (req.body.visibility !== undefined) {
      const nextVisibility = String(req.body.visibility).toUpperCase();
      if (!['TEAM', 'MANAGER_ONLY', 'PRIVATE'].includes(nextVisibility)) return res.status(400).json({ error: 'Invalid visibility' });
      updates.visibility = nextVisibility;
    }
    if (req.body.deadline !== undefined) updates.deadline = req.body.deadline || null;
    if (req.body.completion_pct !== undefined) {
      const pct = Number(req.body.completion_pct);
      if (isNaN(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'completion_pct must be between 0 and 100' });
      updates.completion_pct = pct;
    }
    if (req.body.weightage !== undefined) {
      const newWeight = Number(req.body.weightage);
      if (isNaN(newWeight) || newWeight < 10) return res.status(400).json({ error: 'Minimum weightage is 10%' });

      // Validate against team pool on the CURRENT (or unchanged) owner's sheet
      const isOwnerChanging = req.body.owner_id !== undefined && isManagerOrAdmin && Number(req.body.owner_id) !== goal.owner_id;
      if (!isOwnerChanging) {
        // Check team goal pool only (team goals are separate budget from individual goals)
        const { data: siblings } = await supabase.from('goals').select('id, weightage, team_id').eq('goal_sheet_id', sheet.id).neq('id', goal.id);
        const teamSiblings = (siblings || []).filter(g => g.team_id != null);
        const teamSiblingsTotal = teamSiblings.reduce((s, g) => s + Number(g.weightage || 0), 0);
        if (teamSiblingsTotal + newWeight > 100) {
          return res.status(400).json({ error: `Team goal weightage would exceed 100% in team pool (others: ${teamSiblingsTotal}%)` });
        }
      }
      updates.weightage = newWeight;
    }


    const { data: updated, error } = await supabase.from('goals').update(updates).eq('id', goal.id).select().single();
    if (error) throw error;

    await logTeamEvent({ userId: req.user.id, action: 'TEAM_GOAL_UPDATED', entity: 'goal', entityId: goal.id,
      detail: { note: `Team goal updated`, team_id: team.id, before: goal, after: updated } });
    await supabase.from('goal_activity_log').insert({
      goal_id: goal.id,
      team_id: team.id,
      actor_id: req.user.id,
      activity_type: 'GOAL_UPDATED',
      detail: { before: { goal_status: goal.goal_status, priority: goal.priority }, after: { goal_status: updated.goal_status, priority: updated.priority } },
    });
    await notifyTeamMembers(team.id, 'Team goal updated', `${req.user.name || 'A teammate'} updated "${updated.title}"`, req.user.id, { goal_id: updated.id });

    res.json(updated);
  } catch (err) {
    console.error('PATCH /:teamId/goals/:goalId:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:teamId/goals/:goalId — delete a team goal
router.delete('/:teamId/goals/:goalId', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });

    const { data: goal } = await supabase.from('goals').select('*, goal_sheets(*)').eq('id', req.params.goalId).maybeSingle();
    if (!goal || Number(goal.team_id) !== Number(team.id)) return res.status(404).json({ error: 'Goal not found in this team' });

    const sheet = goal.goal_sheets;
    const isOwner = Number(sheet?.employee_id) === Number(req.user.id);
    const isManagerOrAdmin = req.user.role === 'ADMIN' || (req.user.role === 'MANAGER' && Number(team.manager_id) === Number(req.user.id));
    if (!isOwner && !isManagerOrAdmin) return res.status(403).json({ error: 'You can only delete your own team goals' });
    if (sheet && ['APPROVED', 'PENDING_APPROVAL'].includes(sheet.status)) {
      return res.status(403).json({ error: 'Goal sheet is locked — cannot delete goals' });
    }

    const { error } = await supabase.from('goals').delete().eq('id', goal.id);
    if (error) throw error;

    await logTeamEvent({ userId: req.user.id, action: 'TEAM_GOAL_DELETED', entity: 'goal', entityId: goal.id,
      detail: { note: `Deleted team goal: ${goal.title}`, team_id: team.id } });
    await supabase.from('goal_activity_log').insert({
      goal_id: goal.id,
      team_id: team.id,
      actor_id: req.user.id,
      activity_type: 'GOAL_DELETED',
      detail: { title: goal.title },
    });
    await notifyTeamMembers(team.id, 'Team goal removed', `${req.user.name || 'A teammate'} removed "${goal.title}"`, req.user.id, { goal_id: goal.id });

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /:teamId/goals/:goalId:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:teamId/analytics

router.get('/:teamId/analytics', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });

    const members = await getTeamMembers(team.id, 'active');
    const { data: goals, error } = await supabase.from('goals').select('id, goal_sheet_id').eq('team_id', team.id);
    if (error) throw error;
    const goalIds = (goals || []).map(goal => goal.id);
    const sheets = goals?.length
      ? (await supabase.from('goal_sheets').select('id, employee_id, cycle_id').in('id', goals.map(goal => goal.goal_sheet_id))).data || []
      : [];
    const achievements = goalIds.length
      ? (await supabase.from('goal_achievements').select('goal_id, cycle_id, score').in('goal_id', goalIds)).data || []
      : [];
    const scores = achievements.filter(item => item.score != null).map(item => Number(item.score || 0));
    const avgScore = scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 : 0;
    const completed = achievements.filter(item => item.score != null && Number(item.score) >= 80).length;

    res.json({
      team,
      summary: {
        member_count: members.length,
        goal_count: (goals || []).length,
        active_goal_count: (goals || []).length,
        avg_progress: avgScore,
        completion_rate: goalIds.length ? Math.round((completed / goalIds.length) * 100) : 0,
      },
      members,
      goals,
      sheets,
      achievements,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:teamId/members/requests
router.get('/:teamId/members/requests', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });

    const status = req.query.status ? String(req.query.status) : 'pending';
    const requests = await getTeamRequests(team.id, status === 'all' ? null : status);
    res.json({ team, requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:teamId/goals/:goalId/activity
router.get('/:teamId/goals/:goalId/activity', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });
    const { data, error } = await supabase
      .from('goal_activity_log')
      .select('id, goal_id, team_id, actor_id, activity_type, detail, created_at')
      .eq('goal_id', Number(req.params.goalId))
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ activity: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:teamId/goals/:goalId/milestones
router.post('/:teamId/goals/:goalId/milestones', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });
    const title = sanitizeText(req.body.title, 200);
    if (!title) return res.status(400).json({ error: 'Milestone title is required' });
    const payload = {
      goal_id: Number(req.params.goalId),
      title,
      description: sanitizeText(req.body.description, 1000),
      due_date: req.body.due_date || null,
      milestone_status: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED'].includes(String(req.body.milestone_status || '').toUpperCase())
        ? String(req.body.milestone_status).toUpperCase()
        : 'NOT_STARTED',
      progress_pct: Math.max(0, Math.min(100, Number(req.body.progress_pct || 0))),
      priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(req.body.priority || '').toUpperCase())
        ? String(req.body.priority).toUpperCase()
        : 'MEDIUM',
      assignee_id: req.body.assignee_id ? Number(req.body.assignee_id) : null,
      created_by: req.user.id,
    };
    const { data, error } = await supabase.from('team_goal_milestones').insert(payload).select().single();
    if (error) throw error;
    await supabase.from('goal_activity_log').insert({
      goal_id: Number(req.params.goalId),
      team_id: team.id,
      actor_id: req.user.id,
      activity_type: 'MILESTONE_CREATED',
      detail: { milestone_id: data.id, title: data.title },
    });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:teamId/goals/:goalId/milestones', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });
    const { data, error } = await supabase.from('team_goal_milestones').select('*').eq('goal_id', Number(req.params.goalId)).order('created_at');
    if (error) throw error;
    res.json({ milestones: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPSERT contribution
router.post('/:teamId/goals/:goalId/contributions', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });
    const memberId = Number(req.body.member_id);
    const contributionPct = Number(req.body.contribution_pct);
    if (!memberId || isNaN(contributionPct) || contributionPct < 0 || contributionPct > 100) {
      return res.status(400).json({ error: 'Valid member_id and contribution_pct (0..100) required' });
    }
    const { data, error } = await supabase.from('team_goal_contributions').upsert({
      goal_id: Number(req.params.goalId),
      member_id: memberId,
      contribution_pct: contributionPct,
      contribution_note: sanitizeText(req.body.contribution_note, 1000),
      created_by: req.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'goal_id,member_id' }).select().single();
    if (error) throw error;
    await supabase.from('goal_activity_log').insert({
      goal_id: Number(req.params.goalId),
      team_id: team.id,
      actor_id: req.user.id,
      activity_type: 'CONTRIBUTION_UPDATED',
      detail: { member_id: memberId, contribution_pct: contributionPct },
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:teamId/goals/:goalId/contributions', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });
    const { data, error } = await supabase.from('team_goal_contributions').select('*').eq('goal_id', Number(req.params.goalId));
    if (error) throw error;
    res.json({ contributions: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function reviewRequest(req, res, status) {
  const team = await getTeam(req.params.teamId);
  if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
  if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });

  const { data: request, error } = await supabase.from('team_join_requests').select('*').eq('id', req.params.requestId).maybeSingle();
  if (error) throw error;
  if (!request || Number(request.team_id) !== Number(team.id)) return res.status(404).json({ error: 'Join request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request already reviewed' });

  const reviewedAt = new Date().toISOString();
  const updates = {
    status,
    reviewed_by: req.user.id,
    reviewed_at: reviewedAt,
  };
  if (status === 'rejected') updates.rejection_reason = String(req.body.rejection_reason || '').trim();

  const { data: updatedRequest, error: updateError } = await supabase.from('team_join_requests').update(updates).eq('id', request.id).select().single();
  if (updateError) throw updateError;

  if (status === 'approved') {
    const membershipPayload = {
      team_id: team.id,
      employee_id: request.employee_id,
      joined_at: reviewedAt,
      status: 'active',
    };
    const { data: existingMembership } = await supabase.from('team_members').select('*').eq('team_id', team.id).eq('employee_id', request.employee_id).maybeSingle();
    if (existingMembership) {
      const { error: memberUpdateError } = await supabase.from('team_members').update(membershipPayload).eq('id', existingMembership.id);
      if (memberUpdateError) throw memberUpdateError;
    } else {
      const { error: memberInsertError } = await supabase.from('team_members').insert(membershipPayload);
      if (memberInsertError) throw memberInsertError;
    }
  }

  await logTeamEvent({
    userId: req.user.id,
    action: 'TEAM_EVENT',
    entity: 'team_join_request',
    entityId: request.id,
    detail: {
      note: status === 'approved'
        ? `Approved join request for team ${team.name}`
        : `Rejected join request for team ${team.name}`,
      before: request,
      after: updatedRequest,
    },
  });

  return res.json(updatedRequest);
}

// POST /api/teams/:teamId/members/requests/:requestId/approve
router.post('/:teamId/members/requests/:requestId/approve', requireAuth, async (req, res) => {
  try {
    await reviewRequest(req, res, 'approved');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:teamId/members/requests/:requestId/reject
router.post('/:teamId/members/requests/:requestId/reject', requireAuth, async (req, res) => {
  try {
    await reviewRequest(req, res, 'rejected');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:teamId/members/request
router.post('/:teamId/members/request', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'EMPLOYEE') {
      return res.status(403).json({ error: 'Only employees can submit join requests' });
    }

    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });

    const activeMembership = await supabase.from('team_members').select('id').eq('team_id', team.id).eq('employee_id', req.user.id).eq('status', 'active').maybeSingle();
    if (activeMembership.data) return res.status(400).json({ error: 'You are already a member of this team' });
    const pendingRequest = await supabase.from('team_join_requests').select('id').eq('team_id', team.id).eq('employee_id', req.user.id).eq('status', 'pending').maybeSingle();
    if (pendingRequest.data) return res.status(400).json({ error: 'You already have a pending request for this team' });

    const { data: request, error } = await supabase.from('team_join_requests').insert({
      team_id: team.id,
      employee_id: req.user.id,
      status: 'pending',
    }).select().single();
    if (error) throw error;

    await logTeamEvent({
      userId: req.user.id,
      action: 'TEAM_EVENT',
      entity: 'team_join_request',
      entityId: request.id,
      detail: { note: `Submitted join request for team ${team.name}`, after: request },
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:teamId/members/:employeeId
router.delete('/:teamId/members/:employeeId', requireAuth, async (req, res) => {
  try {
    const team = await getTeam(req.params.teamId);
    if (!team || team.is_active === false) return res.status(404).json({ error: 'Team not found' });
    if (!(await assertTeamAccess(req, team))) return res.status(403).json({ error: 'Forbidden' });

    const employeeId = Number(req.params.employeeId);
    const { data: membership, error } = await supabase.from('team_members').select('*').eq('team_id', team.id).eq('employee_id', employeeId).maybeSingle();
    if (error) throw error;
    if (!membership) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const { data: updated, error: updateError } = await supabase.from('team_members').update({ status: 'removed' }).eq('id', membership.id).select().single();
    if (updateError) throw updateError;

    await logTeamEvent({
      userId: req.user.id,
      action: 'TEAM_EVENT',
      entity: 'team_member',
      entityId: membership.id,
      detail: {
        note: `Removed employee ${employeeId} from team ${team.name}`,
        before: membership,
        after: updated,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/my/summary
router.get('/my/summary', requireAuth, async (req, res) => {
  try {
    const memberships = (await supabase.from('team_members').select('*').eq('employee_id', req.user.id).eq('status', 'active').order('joined_at', { ascending: false })).data || [];
    const teamRows = memberships.length
      ? (await supabase.from('teams').select('id, name, description, manager_id, created_at, is_active').in('id', memberships.map(item => item.team_id))).data || []
      : [];
    const managerRows = await getUsersByIds(teamRows.map(team => team.manager_id));
    const managerMap = new Map(managerRows.map(user => [Number(user.id), user]));
    const teamMap = new Map(teamRows.map(team => [Number(team.id), team]));
    const requests = (await supabase.from('team_join_requests').select('*').eq('employee_id', req.user.id).order('requested_at', { ascending: false })).data || [];
    res.json({
      memberships: memberships.map(membership => ({
        ...membership,
        team: {
          ...teamMap.get(Number(membership.team_id)),
          manager: managerMap.get(Number(teamMap.get(Number(membership.team_id))?.manager_id)) || null,
        },
      })),
      requests: requests.map(request => ({
        ...request,
        team: teamMap.get(Number(request.team_id)) || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
