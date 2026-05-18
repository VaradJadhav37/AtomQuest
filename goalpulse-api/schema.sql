-- GoalKeeper Schema for Supabase PostgreSQL
-- Run via: node src/migrate.js

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('EMPLOYEE','MANAGER','ADMIN')),
  password_hash TEXT NOT NULL,
  manager_id  INTEGER REFERENCES users(id),
  department  TEXT DEFAULT 'General',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cycles (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  year       INTEGER NOT NULL,
  quarter    INTEGER NOT NULL CHECK(quarter BETWEEN 1 AND 4),
  open_date  DATE NOT NULL,
  close_date DATE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS cycles_name_uidx ON cycles(name);

CREATE TABLE IF NOT EXISTS thrust_areas (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS goal_sheets (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES users(id),
  cycle_id    INTEGER NOT NULL REFERENCES cycles(id),
  status      TEXT NOT NULL DEFAULT 'DRAFT'
                CHECK(status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED')),
  locked_at   TIMESTAMPTZ,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, cycle_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  manager_id  INTEGER NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(manager_id, name)
);

CREATE TABLE IF NOT EXISTS goals (
  id            SERIAL PRIMARY KEY,
  goal_sheet_id INTEGER NOT NULL REFERENCES goal_sheets(id) ON DELETE CASCADE,
  team_id       INTEGER REFERENCES teams(id),
  title         TEXT NOT NULL,
  uom_type      TEXT NOT NULL CHECK(uom_type IN ('Numeric','Percentage','Timeline','Zero')),
  target_value  TEXT NOT NULL,
  weightage     INTEGER NOT NULL CHECK(weightage BETWEEN 1 AND 100),
  thrust_area   TEXT DEFAULT 'General',
  description   TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id          SERIAL PRIMARY KEY,
  team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'removed')),
  UNIQUE(team_id, employee_id)
);

CREATE TABLE IF NOT EXISTS team_join_requests (
  id               SERIAL PRIMARY KEY,
  team_id          INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  employee_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at     TIMESTAMPTZ DEFAULT NOW(),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  reviewed_by      INTEGER REFERENCES users(id),
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT DEFAULT '',
  UNIQUE(team_id, employee_id, status)
);

CREATE TABLE IF NOT EXISTS goal_achievements (
  id           SERIAL PRIMARY KEY,
  goal_id      INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  cycle_id     INTEGER NOT NULL REFERENCES cycles(id),
  actual_value TEXT NOT NULL,
  score        NUMERIC(5,2),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id, cycle_id)
);

CREATE TABLE IF NOT EXISTS check_ins (
  id                    SERIAL PRIMARY KEY,
  goal_id               INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  cycle_id              INTEGER NOT NULL REFERENCES cycles(id),
  status                TEXT NOT NULL DEFAULT 'ON_TRACK'
                        CHECK(status IN ('NOT_STARTED','ON_TRACK','COMPLETED')),
  employee_comment      TEXT DEFAULT '',
  manager_comment       TEXT DEFAULT '',
  employee_submitted_at TIMESTAMPTZ,
  manager_submitted_at  TIMESTAMPTZ,
  UNIQUE(goal_id, cycle_id)
);

CREATE TABLE IF NOT EXISTS shared_goals (
  id                 SERIAL PRIMARY KEY,
  source_goal_id     INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  linked_goal_id     INTEGER NOT NULL UNIQUE REFERENCES goals(id) ON DELETE CASCADE,
  target_employee_id INTEGER NOT NULL REFERENCES users(id),
  primary_owner_id   INTEGER NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER REFERENCES users(id),
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id INTEGER,
  detail    TEXT,
  ts        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalation_rules (
    id SERIAL PRIMARY KEY,
    trigger_type VARCHAR(100) NOT NULL,
    threshold_days INTEGER NOT NULL DEFAULT 3,
    action VARCHAR(100) NOT NULL DEFAULT 'NOTIFY_MANAGER',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS escalation_events (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES escalation_rules(id) ON DELETE CASCADE,
    entity_id INTEGER NOT NULL,
    assignee_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_telemetry (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_requests INTEGER NOT NULL DEFAULT 0,
    cache_hits INTEGER NOT NULL DEFAULT 0,
    cache_misses INTEGER NOT NULL DEFAULT 0,
    estimated_spend NUMERIC(10, 4) NOT NULL DEFAULT 0,
    routes_json JSONB DEFAULT '{}'::jsonb,
    models_json JSONB DEFAULT '{}'::jsonb,
    last_request_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the singleton row if it doesn't exist
INSERT INTO ai_telemetry (id, total_requests, cache_hits, cache_misses, estimated_spend)
VALUES (1, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

