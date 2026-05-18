-- Enterprise Team Goals expansion
-- Safe additive migration

ALTER TABLE goals ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'MEDIUM'
  CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
ALTER TABLE goals ADD COLUMN IF NOT EXISTS goal_status TEXT NOT NULL DEFAULT 'NOT_STARTED'
  CHECK (goal_status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED'));
ALTER TABLE goals ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'TEAM'
  CHECK (visibility IN ('TEAM', 'MANAGER_ONLY', 'PRIVATE'));
ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0
  CHECK (completion_pct >= 0 AND completion_pct <= 100);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS blocked_reason TEXT DEFAULT '';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS goals_team_status_idx ON goals(team_id, goal_status);
CREATE INDEX IF NOT EXISTS goals_team_priority_idx ON goals(team_id, priority);
CREATE INDEX IF NOT EXISTS goals_owner_idx ON goals(owner_id);
CREATE INDEX IF NOT EXISTS goals_deadline_idx ON goals(deadline);

CREATE TABLE IF NOT EXISTS team_goal_milestones (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date DATE,
  milestone_status TEXT NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (milestone_status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED')),
  progress_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  assignee_id INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_goal_milestones_goal_idx ON team_goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS team_goal_milestones_status_idx ON team_goal_milestones(milestone_status);

CREATE TABLE IF NOT EXISTS team_goal_contributions (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (contribution_pct >= 0 AND contribution_pct <= 100),
  contribution_note TEXT DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id, member_id)
);

CREATE TABLE IF NOT EXISTS goal_activity_log (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  detail JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goal_activity_log_goal_idx ON goal_activity_log(goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS goal_activity_log_team_idx ON goal_activity_log(team_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'TEAM_GOAL',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, read_at);
