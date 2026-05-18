const express = require('express');
const { supabase } = require('../db');
const { requireAuth } = require('./auth');

const router = express.Router();

function isAdmin(user) {
  return user?.role === 'ADMIN';
}

function isManager(user) {
  return user?.role === 'MANAGER';
}

async function logTeamEvent({ userId, action, entity, entityId, detail }) {
  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
  });
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
  const memberRows = allTeamIds.length
    ? (await supabase.from('team_members').select('team_id, employee_id, status').in('team_id', allTeamIds).eq('status', 'active')).data || []
    : [];
  const goals = allTeamIds.length
    ? (await supabase.from('goals').select('id, team_id').in('team_id', allTeamIds)).data || []
    : [];
  const achievements = goals.length
    ? (await supabase.from('goal_achievements').select('goal_id, score').in('goal_id', goals.map(goal => goal.id))).data || []
    : [];
  return teams.map(team => {
    const teamMemberCount = memberRows.filter(member => Number(member.team_id) === Number(team.id)).length;
    const teamGoals = goals.filter(goal => Number(goal.team_id) === Number(team.id));
    const teamGoalIds = teamGoals.map(goal => goal.id);
    const teamScores = achievements.filter(item => teamGoalIds.includes(item.goal_id) && item.score != null).map(item => Number(item.score || 0));
    const avgProgress = teamScores.length ? Math.round((teamScores.reduce((sum, score) => sum + score, 0) / teamScores.length) * 10) / 10 : 0;

    return {
      ...team,
      member_count: teamMemberCount,
      goal_count: teamGoals.length,
      avg_progress: avgProgress,
    };
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
    const managerRows = await getUsersByIds(teamRows.map(team => team.manager_id));
    const managerMap = new Map(managerRows.map(user => [Number(user.id), user]));
    const teamMap = new Map(teamRows.map(team => [Number(team.id), team]));

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
      activeTeams: teamRows.map(team => ({
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

    const { data: goals, error } = await supabase
      .from('goals')
      .select('id, goal_sheet_id, team_id, title, uom_type, target_value, weightage, thrust_area, description, created_at')
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

    res.json({
      team,
      goals: (goals || []).map(goal => {
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
        };
      }),
    });
  } catch (err) {
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
