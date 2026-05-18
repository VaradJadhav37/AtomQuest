// src/seed.js - Rich demo dataset for GoalKeeper
require('dotenv').config();
const { supabase } = require('./db');
const bcrypt = require('bcryptjs');

const PWD = 'Demo@1234';
const HASH = bcrypt.hashSync(PWD, 10);

const users = [
  { email: 'admin@goalkeeper.com', name: 'Alex Admin', role: 'ADMIN', department: 'Leadership', managerEmail: null },
  { email: 'manager@goalkeeper.com', name: 'Maya Manager', role: 'MANAGER', department: 'Sales', managerEmail: 'admin@goalkeeper.com' },
  { email: 'employee@goalkeeper.com', name: 'Eric Employee', role: 'EMPLOYEE', department: 'Sales', managerEmail: 'manager@goalkeeper.com' },
  { email: 'priya@goalkeeper.com', name: 'Priya Sharma', role: 'EMPLOYEE', department: 'Sales', managerEmail: 'manager@goalkeeper.com' },
  { email: 'ravi@goalkeeper.com', name: 'Ravi Menon', role: 'EMPLOYEE', department: 'Operations', managerEmail: 'manager@goalkeeper.com' },
];

const thrustAreas = [
  'Revenue Growth',
  'Customer Satisfaction',
  'Operational Efficiency',
  'People Development',
  'Innovation',
  'Compliance & Risk',
];

const cycles = [
  { name: 'FY2025-Q1', year: 2025, quarter: 1, open_date: '2025-01-01', close_date: '2025-03-31', status: 'CLOSED' },
  { name: 'FY2025-Q2', year: 2025, quarter: 2, open_date: '2025-04-01', close_date: '2025-06-30', status: 'CLOSED' },
  { name: 'FY2025-Q3', year: 2025, quarter: 3, open_date: '2025-07-01', close_date: '2025-09-30', status: 'CLOSED' },
  { name: 'FY2025-Q4', year: 2025, quarter: 4, open_date: '2025-10-01', close_date: '2025-12-31', status: 'CLOSED' },
  { name: 'FY2026-Q1', year: 2026, quarter: 1, open_date: '2026-04-01', close_date: '2026-06-30', status: 'OPEN' },
];

const cycleScoreProfiles = {
  'FY2025-Q1': [46, 58, 68],
  'FY2025-Q2': [58, 68, 78],
  'FY2025-Q3': [69, 79, 86],
  'FY2025-Q4': [82, 90, 96],
  'FY2026-Q1': [74, 84, 92],
};

const userGoalTemplates = {
  'admin@goalkeeper.com': [
    { title: 'Expand partner pipeline', uom_type: 'Numeric', target_value: '1500000', weightage: 40, thrust_area: 'Revenue Growth' },
    { title: 'Governance audit completion', uom_type: 'Zero', target_value: '0', weightage: 35, thrust_area: 'Compliance & Risk' },
    { title: 'AI enablement rollout', uom_type: 'Percentage', target_value: '80', weightage: 25, thrust_area: 'Innovation' },
  ],
  'manager@goalkeeper.com': [
    { title: 'Quarterly team revenue', uom_type: 'Numeric', target_value: '900000', weightage: 20, thrust_area: 'Revenue Growth' },
    { title: 'Coach and unblock team', uom_type: 'Zero', target_value: '0', weightage: 30, thrust_area: 'People Development' },
    { title: 'Improve review turnaround', uom_type: 'Percentage', target_value: '95', weightage: 30, thrust_area: 'Operational Efficiency' },
  ],
  'employee@goalkeeper.com': [
    { title: 'New pipeline creation', uom_type: 'Numeric', target_value: '1200000', weightage: 40, thrust_area: 'Revenue Growth' },
    { title: 'Customer retention', uom_type: 'Percentage', target_value: '96', weightage: 35, thrust_area: 'Customer Satisfaction' },
    { title: 'Compliance training', uom_type: 'Zero', target_value: '0', weightage: 25, thrust_area: 'Compliance & Risk' },
  ],
  'priya@goalkeeper.com': [
    { title: 'Enterprise expansion ARR', uom_type: 'Numeric', target_value: '600000', weightage: 40, thrust_area: 'Revenue Growth' },
    { title: 'Close enterprise accounts', uom_type: 'Numeric', target_value: '12', weightage: 35, thrust_area: 'Customer Satisfaction' },
    { title: 'Launch upsell playbook', uom_type: 'Percentage', target_value: '85', weightage: 25, thrust_area: 'Innovation' },
  ],
  'ravi@goalkeeper.com': [
    { title: 'Certify on product stack', uom_type: 'Zero', target_value: '0', weightage: 35, thrust_area: 'People Development' },
    { title: 'Reduce resolution time', uom_type: 'Percentage', target_value: '80', weightage: 40, thrust_area: 'Operational Efficiency' },
    { title: 'Reduce incident repeat rate', uom_type: 'Percentage', target_value: '90', weightage: 25, thrust_area: 'Compliance & Risk' },
  ],
};

const roleOffsets = {
  ADMIN: 2,
  MANAGER: 0,
  EMPLOYEE: -4,
};

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreForGoal(cycleName, user, goalIndex) {
  const base = cycleScoreProfiles[cycleName][goalIndex];
  const offset = roleOffsets[user.role] || 0;
  const extra = user.email === 'ravi@goalkeeper.com' ? -6 : user.email === 'priya@goalkeeper.com' ? 4 : 0;
  return clampScore(base + offset + extra);
}

function actualValueForGoal(goal, score, cycle) {
  if (goal.uom_type === 'Zero') return score >= 90 ? '0' : '1';
  if (goal.uom_type === 'Percentage') return (score * 0.98).toFixed(1);
  if (goal.uom_type === 'Timeline') return cycle.close_date;
  const target = Number(goal.target_value || 0);
  return String(Math.round((target * score) / 100));
}

function statusForSheet(cycle, user) {
  if (cycle.status === 'OPEN') {
    if (user.email === 'ravi@goalkeeper.com') return 'DRAFT';
    if (user.email === 'priya@goalkeeper.com' || user.email === 'employee@goalkeeper.com') return 'APPROVED';
    return 'DRAFT';
  }
  return 'APPROVED';
}

async function resetTables() {
  const tables = [
    'audit_log',
    'team_join_requests',
    'team_members',
    'shared_goals',
    'check_ins',
    'goal_achievements',
    'goals',
    'goal_sheets',
    'teams',
    'escalation_events',
    'escalation_rules',
    'thrust_areas',
    'cycles',
    'users',
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', 0);
    if (error && error.code !== '42P01') throw error;
  }
}

async function setup() {
  console.log('Connecting to Supabase:', process.env.SUPABASE_URL);

  const { error: pingErr } = await supabase.from('users').select('id').limit(1);
  if (pingErr && pingErr.code !== 'PGRST116' && !String(pingErr.message || '').includes('does not exist')) {
    console.log('Tables may not exist yet - this is expected on first run');
    console.log('Please create tables via Supabase Dashboard SQL editor using schema.sql');
    console.log('Then re-run: node src/seed.js');
    process.exit(0);
  }

  console.log('Seeding rich demo data...');
  await resetTables();

  const userRows = {};
  for (const user of users) {
    const manager_id = user.managerEmail ? userRows[user.managerEmail]?.id || null : null;
    const { data, error } = await supabase.from('users').insert({
      email: user.email,
      name: user.name,
      role: user.role,
      password_hash: HASH,
      manager_id,
      department: user.department,
    }).select().single();
    if (error) throw error;
    userRows[user.email] = data;
  }

  const cycleRows = {};
  for (const cycle of cycles) {
    const { data, error } = await supabase.from('cycles').insert(cycle).select().single();
    if (error) throw error;
    cycleRows[cycle.name] = data;
  }

  const teamSeed = [
    { key: 'north_star', name: 'North Star Sales', description: 'Revenue-focused execution pod for enterprise accounts.' },
    { key: 'ops_pod', name: 'Ops Pod', description: 'Operational excellence and delivery governance team.' },
  ];
  const teamRows = {};
  for (const team of teamSeed) {
    const { data, error } = await supabase.from('teams').insert({
      name: team.name,
      description: team.description,
      manager_id: userRows['manager@goalkeeper.com'].id,
      is_active: true,
    }).select().single();
    if (error) throw error;
    teamRows[team.key] = data;
  }

  const membershipSeed = [
    { team_id: teamRows.north_star.id, employee_id: userRows['employee@goalkeeper.com'].id },
    { team_id: teamRows.north_star.id, employee_id: userRows['priya@goalkeeper.com'].id },
    { team_id: teamRows.ops_pod.id, employee_id: userRows['ravi@goalkeeper.com'].id },
  ];
  for (const membership of membershipSeed) {
    const { error } = await supabase.from('team_members').insert({
      ...membership,
      status: 'active',
      joined_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  const { error: requestErr } = await supabase.from('team_join_requests').insert({
    team_id: teamRows.north_star.id,
    employee_id: userRows['ravi@goalkeeper.com'].id,
    status: 'pending',
  });
  if (requestErr) throw requestErr;

  await supabase.from('thrust_areas').insert(thrustAreas.map(name => ({ name })));

  const sheetRows = {};
  const goalRows = [];
  const achievementRows = [];
  const checkInRows = [];

  for (const cycle of cycles) {
    const cycleRow = cycleRows[cycle.name];
    for (const user of users) {
      const userRow = userRows[user.email];
      const status = statusForSheet(cycle, user);
      const locked_at = status === 'APPROVED' ? `${cycle.close_date}T00:00:00Z` : null;

      const { data: sheet, error: sheetErr } = await supabase
        .from('goal_sheets')
        .insert({
          employee_id: userRow.id,
          cycle_id: cycleRow.id,
          status,
          locked_at,
        })
        .select()
        .single();
      if (sheetErr) throw sheetErr;

      sheetRows[`${user.email}:${cycle.name}`] = sheet;

      const templates = userGoalTemplates[user.email];
      for (let i = 0; i < templates.length; i++) {
        const template = templates[i];
        const score = scoreForGoal(cycle.name, user, i);
        const goalPayload = {
          goal_sheet_id: sheet.id,
          title: `${cycle.name} - ${template.title}`,
          uom_type: template.uom_type,
          target_value: template.target_value,
          weightage: template.weightage,
          thrust_area: template.thrust_area,
          description: `${template.title} for ${cycle.name}`,
          team_id:
              cycle.name === 'FY2026-Q1'
                ? user.email === 'manager@goalkeeper.com' && i === 0
                  ? teamRows.north_star.id
                  : user.email === 'priya@goalkeeper.com' && i === 0
                    ? teamRows.north_star.id
                    : user.email === 'ravi@goalkeeper.com' && i === 1
                      ? teamRows.ops_pod.id
                      : null
                : null,
        };

        let { data: goal, error: goalErr } = await supabase.from('goals').insert(goalPayload).select().single();
        if (goalErr && (String(goalErr.message || '').includes('team_id') || goalErr.code === 'PGRST204')) {
          const fallbackPayload = { ...goalPayload };
          delete fallbackPayload.team_id;
          const retryRes = await supabase.from('goals').insert(fallbackPayload).select().single();
          goal = retryRes.data;
          goalErr = retryRes.error;
        }
        if (goalErr) throw goalErr;
        goalRows.push(goal);

        const actualValue = actualValueForGoal(template, score, cycle);
        const { error: achErr } = await supabase.from('goal_achievements').insert({
          goal_id: goal.id,
          cycle_id: cycleRow.id,
          actual_value: actualValue,
          score,
        });
        if (achErr) throw achErr;

        const checkInStatus = score >= 90 ? 'COMPLETED' : score >= 60 ? 'ON_TRACK' : 'NOT_STARTED';
        const { error: checkErr } = await supabase.from('check_ins').insert({
          goal_id: goal.id,
          cycle_id: cycleRow.id,
          status: checkInStatus,
          employee_comment: `${user.name} update for ${cycle.name} - ${template.title}`,
          manager_comment: `${user.managerEmail ? userRows[user.managerEmail].name : 'Leadership'} review for ${template.title}`,
          employee_submitted_at: `${cycle.close_date}T09:00:00Z`,
          manager_submitted_at: `${cycle.close_date}T17:00:00Z`,
        });
        if (checkErr) throw checkErr;
        checkInRows.push(goal.id);
      }
    }
  }

  const currentCycle = cycleRows['FY2026-Q1'];
  const employeeCurrentSheet = sheetRows['employee@goalkeeper.com:FY2026-Q1'];
  const managerCurrentSheet = sheetRows['manager@goalkeeper.com:FY2026-Q1'];
  const priyaCurrentSheet = sheetRows['priya@goalkeeper.com:FY2026-Q1'];
  const raviCurrentSheet = sheetRows['ravi@goalkeeper.com:FY2026-Q1'];

  // Create one shared goal in the current cycle so the manager view has linked data too.
  const { data: sharedSource, error: sharedSourceErr } = await supabase.from('goals').insert({
    goal_sheet_id: managerCurrentSheet.id,
    title: 'FY2026-Q1 - Launch Enterprise Upsell Playbook',
    uom_type: 'Numeric',
    target_value: '8',
    weightage: 20,
    thrust_area: 'Revenue Growth',
    description: 'A shared team goal with synced progress across recipients.',
  }).select().single();
  if (sharedSourceErr) throw sharedSourceErr;

  const { data: sharedLinked, error: sharedLinkedErr } = await supabase.from('goals').insert({
    goal_sheet_id: raviCurrentSheet.id,
    title: 'FY2026-Q1 - Launch Enterprise Upsell Playbook',
    uom_type: 'Numeric',
    target_value: '8',
    weightage: 20,
    thrust_area: 'Revenue Growth',
    description: 'A shared team goal with synced progress across recipients.',
  }).select().single();
  if (sharedLinkedErr) throw sharedLinkedErr;

  await supabase.from('shared_goals').insert([
    { source_goal_id: sharedSource.id, linked_goal_id: sharedSource.id, target_employee_id: userRows['manager@goalkeeper.com'].id, primary_owner_id: userRows['manager@goalkeeper.com'].id },
    { source_goal_id: sharedSource.id, linked_goal_id: sharedLinked.id, target_employee_id: userRows['ravi@goalkeeper.com'].id, primary_owner_id: userRows['manager@goalkeeper.com'].id },
  ]);

  await supabase.from('audit_log').insert([
    { user_id: userRows['manager@goalkeeper.com'].id, action: 'APPROVED', entity: 'goal_sheet', entity_id: managerCurrentSheet.id, detail: 'Approved FY2026-Q1 goal sheet for Maya Manager' },
    { user_id: userRows['employee@goalkeeper.com'].id, action: 'SUBMITTED', entity: 'goal_sheet', entity_id: employeeCurrentSheet.id, detail: 'Submitted FY2026-Q1 goal sheet for approval' },
    { user_id: userRows['employee@goalkeeper.com'].id, action: 'CHECK_IN', entity: 'goal', entity_id: goalRows[0].id, detail: 'Submitted Q1 check-in for Pipeline goal' },
  ]);

  await supabase.from('escalation_rules').insert([
    { trigger_type: 'DRAFT_OVERDUE', threshold_days: 5, action: 'NOTIFY_EMPLOYEE', is_active: true },
    { trigger_type: 'APPROVAL_OVERDUE', threshold_days: 3, action: 'NOTIFY_MANAGER', is_active: true },
    { trigger_type: 'CHECKIN_OVERDUE', threshold_days: 7, action: 'NOTIFY_MANAGER', is_active: true },
  ]);

  console.log('');
  console.log('Supabase seeded successfully.');
  console.log('');
  console.log('Demo accounts:');
  console.log('  employee@goalkeeper.com / Demo@1234');
  console.log('  manager@goalkeeper.com  / Demo@1234');
  console.log('  admin@goalkeeper.com    / Demo@1234');
}

if (require.main === module) {
  setup().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}

module.exports = setup;
