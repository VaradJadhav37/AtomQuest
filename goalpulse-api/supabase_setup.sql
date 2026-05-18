-- ═══════════════════════════════════════════════════════════════
-- GOALKEEPER — SUPABASE SETUP SQL
-- Paste this ENTIRE file into Supabase Dashboard → SQL Editor → Run
-- URL: https://supabase.com/dashboard/project/lrtpvwzppxttmlqabuhu/sql/new
-- ═══════════════════════════════════════════════════════════════

-- STEP 1: Create Tables
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('EMPLOYEE','MANAGER','ADMIN')),
  password_hash TEXT NOT NULL,
  manager_id    INTEGER REFERENCES users(id),
  department    TEXT DEFAULT 'General',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS audit_log (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER REFERENCES users(id),
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id INTEGER,
  detail    TEXT,
  ts        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_goals (
  id                 SERIAL PRIMARY KEY,
  source_goal_id     INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  linked_goal_id     INTEGER NOT NULL UNIQUE REFERENCES goals(id) ON DELETE CASCADE,
  target_employee_id INTEGER NOT NULL REFERENCES users(id),
  primary_owner_id   INTEGER NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW()
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

-- STEP 2: Enable RLS and allow all (app-level JWT auth handles security)
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_sheets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_goals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE thrust_areas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_telemetry    ENABLE ROW LEVEL SECURITY;

-- Normalize older tables created by previous script versions
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_uom_type_check;
ALTER TABLE goals ADD CONSTRAINT goals_uom_type_check
  CHECK(uom_type IN ('Numeric','Percentage','Timeline','Zero')) NOT VALID;

ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ON_TRACK';
ALTER TABLE check_ins DROP CONSTRAINT IF EXISTS check_ins_status_check;
ALTER TABLE check_ins ADD CONSTRAINT check_ins_status_check
  CHECK(status IN ('NOT_STARTED','ON_TRACK','COMPLETED')) NOT VALID;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_users') THEN
    CREATE POLICY allow_all_users ON users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_cycles') THEN
    CREATE POLICY allow_all_cycles ON cycles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_goal_sheets') THEN
    CREATE POLICY allow_all_goal_sheets ON goal_sheets FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_goals') THEN
    CREATE POLICY allow_all_goals ON goals FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_achievements') THEN
    CREATE POLICY allow_all_achievements ON goal_achievements FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_checkins') THEN
    CREATE POLICY allow_all_checkins ON check_ins FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_audit') THEN
    CREATE POLICY allow_all_audit ON audit_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_shared_goals') THEN
    CREATE POLICY allow_all_shared_goals ON shared_goals FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_escalation_rules') THEN
    CREATE POLICY allow_all_escalation_rules ON escalation_rules FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_escalation_events') THEN
    CREATE POLICY allow_all_escalation_events ON escalation_events FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_thrust') THEN
    CREATE POLICY allow_all_thrust ON thrust_areas FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_teams') THEN
    CREATE POLICY allow_all_teams ON teams FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_team_members') THEN
    CREATE POLICY allow_all_team_members ON team_members FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_team_join_requests') THEN
    CREATE POLICY allow_all_team_join_requests ON team_join_requests FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_ai_telemetry') THEN
    CREATE POLICY allow_all_ai_telemetry ON ai_telemetry FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- STEP 3: Seed demo data
DO $$
DECLARE
  v_admin_id INT;
  v_mgr_id INT;
  v_employee_id INT;
  v_priya_id INT;
  v_ravi_id INT;
  v_cycle_id INT;
  v_sheet_id INT;
  v_goal_id INT;
  v_shared_source_id INT;
  v_shared_linked_id INT;
  v_status TEXT;
  v_score INT;
  user_row RECORD;
  cycle_row RECORD;
  tpl_row RECORD;
BEGIN
  DELETE FROM shared_goals;
  DELETE FROM escalation_events;
  DELETE FROM escalation_rules;
  DELETE FROM check_ins;
  DELETE FROM goal_achievements;
  DELETE FROM goals;
  DELETE FROM team_join_requests;
  DELETE FROM team_members;
  DELETE FROM teams;
  DELETE FROM goal_sheets;
  DELETE FROM audit_log;
  DELETE FROM thrust_areas;
  DELETE FROM cycles;
  DELETE FROM users;

  CREATE UNIQUE INDEX IF NOT EXISTS cycles_name_uidx ON cycles(name);

  -- Users
  INSERT INTO users (email, name, role, password_hash, department)
  VALUES ('admin@goalkeeper.com', 'Alex Admin', 'ADMIN', '$2b$10$Mbx1KboLT7Kk5GuzuNatc.WUTqGLb3hnJQPVIUaW4wbcks3mm.Ok2', 'Leadership')
  RETURNING id INTO v_admin_id;

  INSERT INTO users (email, name, role, password_hash, manager_id, department)
  VALUES ('manager@goalkeeper.com', 'Maya Manager', 'MANAGER', '$2b$10$Mbx1KboLT7Kk5GuzuNatc.WUTqGLb3hnJQPVIUaW4wbcks3mm.Ok2', v_admin_id, 'Sales')
  RETURNING id INTO v_mgr_id;

  INSERT INTO users (email, name, role, password_hash, manager_id, department)
  VALUES ('employee@goalkeeper.com', 'Eric Employee', 'EMPLOYEE', '$2b$10$Mbx1KboLT7Kk5GuzuNatc.WUTqGLb3hnJQPVIUaW4wbcks3mm.Ok2', v_mgr_id, 'Sales')
  RETURNING id INTO v_employee_id;

  INSERT INTO users (email, name, role, password_hash, manager_id, department)
  VALUES ('priya@goalkeeper.com', 'Priya Sharma', 'EMPLOYEE', '$2b$10$Mbx1KboLT7Kk5GuzuNatc.WUTqGLb3hnJQPVIUaW4wbcks3mm.Ok2', v_mgr_id, 'Sales')
  RETURNING id INTO v_priya_id;

  INSERT INTO users (email, name, role, password_hash, manager_id, department)
  VALUES ('ravi@goalkeeper.com', 'Ravi Menon', 'EMPLOYEE', '$2b$10$Mbx1KboLT7Kk5GuzuNatc.WUTqGLb3hnJQPVIUaW4wbcks3mm.Ok2', v_mgr_id, 'Operations')
  RETURNING id INTO v_ravi_id;

  -- Thrust areas
  INSERT INTO thrust_areas (name) VALUES
    ('Revenue Growth'),
    ('Customer Satisfaction'),
    ('Operational Efficiency'),
    ('People Development'),
    ('Innovation'),
    ('Compliance & Risk')
  ON CONFLICT (name) DO NOTHING;

  -- Cycles
  INSERT INTO cycles (name, year, quarter, open_date, close_date, status) VALUES
    ('FY2025-Q1', 2025, 1, '2025-01-01', '2025-03-31', 'CLOSED'),
    ('FY2025-Q2', 2025, 2, '2025-04-01', '2025-06-30', 'CLOSED'),
    ('FY2025-Q3', 2025, 3, '2025-07-01', '2025-09-30', 'CLOSED'),
    ('FY2025-Q4', 2025, 4, '2025-10-01', '2025-12-31', 'CLOSED'),
    ('FY2026-Q1', 2026, 1, '2026-04-01', '2026-06-30', 'OPEN')
  ON CONFLICT (name) DO NOTHING;

  CREATE TEMP TABLE demo_goal_templates (
    email TEXT,
    sort_order INT,
    title TEXT,
    uom_type TEXT,
    target_value TEXT,
    weightage INT,
    thrust_area TEXT
  ) ON COMMIT DROP;

  INSERT INTO demo_goal_templates (email, sort_order, title, uom_type, target_value, weightage, thrust_area) VALUES
    ('admin@goalkeeper.com', 1, 'Expand partner pipeline', 'Numeric', '1500000', 40, 'Revenue Growth'),
    ('admin@goalkeeper.com', 2, 'Governance audit completion', 'Zero', '0', 35, 'Compliance & Risk'),
    ('admin@goalkeeper.com', 3, 'AI enablement rollout', 'Percentage', '80', 25, 'Innovation'),
    ('manager@goalkeeper.com', 1, 'Quarterly team revenue', 'Numeric', '900000', 20, 'Revenue Growth'),
    ('manager@goalkeeper.com', 2, 'Coach and unblock team', 'Zero', '0', 30, 'People Development'),
    ('manager@goalkeeper.com', 3, 'Improve review turnaround', 'Percentage', '95', 30, 'Operational Efficiency'),
    ('employee@goalkeeper.com', 1, 'New pipeline creation', 'Numeric', '1200000', 40, 'Revenue Growth'),
    ('employee@goalkeeper.com', 2, 'Customer retention', 'Percentage', '96', 35, 'Customer Satisfaction'),
    ('employee@goalkeeper.com', 3, 'Compliance training', 'Zero', '0', 25, 'Compliance & Risk'),
    ('priya@goalkeeper.com', 1, 'Enterprise expansion ARR', 'Numeric', '600000', 40, 'Revenue Growth'),
    ('priya@goalkeeper.com', 2, 'Close enterprise accounts', 'Numeric', '12', 35, 'Customer Satisfaction'),
    ('priya@goalkeeper.com', 3, 'Launch upsell playbook', 'Percentage', '85', 25, 'Innovation'),
    ('ravi@goalkeeper.com', 1, 'Certify on product stack', 'Zero', '0', 35, 'People Development'),
    ('ravi@goalkeeper.com', 2, 'Reduce resolution time', 'Percentage', '80', 40, 'Operational Efficiency'),
    ('ravi@goalkeeper.com', 3, 'Reduce incident repeat rate', 'Percentage', '90', 25, 'Compliance & Risk');

  FOR cycle_row IN
    SELECT * FROM (VALUES
      ('FY2025-Q1', 2025, 1, '2025-01-01'::date, '2025-03-31'::date, 'CLOSED'),
      ('FY2025-Q2', 2025, 2, '2025-04-01'::date, '2025-06-30'::date, 'CLOSED'),
      ('FY2025-Q3', 2025, 3, '2025-07-01'::date, '2025-09-30'::date, 'CLOSED'),
      ('FY2025-Q4', 2025, 4, '2025-10-01'::date, '2025-12-31'::date, 'CLOSED'),
      ('FY2026-Q1', 2026, 1, '2026-04-01'::date, '2026-06-30'::date, 'OPEN')
    ) AS c(name, year, quarter, open_date, close_date, status)
  LOOP
    INSERT INTO cycles (name, year, quarter, open_date, close_date, status)
    VALUES (cycle_row.name, cycle_row.year, cycle_row.quarter, cycle_row.open_date, cycle_row.close_date, cycle_row.status)
    ON CONFLICT (name) DO NOTHING;

    SELECT id INTO v_cycle_id FROM cycles WHERE name = cycle_row.name;

    FOR user_row IN
      SELECT * FROM (VALUES
        ('admin@goalkeeper.com', v_admin_id, 'ADMIN'),
        ('manager@goalkeeper.com', v_mgr_id, 'MANAGER'),
        ('employee@goalkeeper.com', v_employee_id, 'EMPLOYEE'),
        ('priya@goalkeeper.com', v_priya_id, 'EMPLOYEE'),
        ('ravi@goalkeeper.com', v_ravi_id, 'EMPLOYEE')
      ) AS u(email, id, role)
    LOOP
      IF cycle_row.status = 'OPEN' THEN
        v_status := CASE user_row.email
          WHEN 'employee@goalkeeper.com' THEN 'APPROVED'
          WHEN 'priya@goalkeeper.com' THEN 'APPROVED'
          ELSE 'DRAFT'
        END;
      ELSE
        v_status := 'APPROVED';
      END IF;

      INSERT INTO goal_sheets (employee_id, cycle_id, status, locked_at)
      VALUES (
        user_row.id,
        v_cycle_id,
        v_status,
        CASE WHEN v_status = 'APPROVED' THEN (cycle_row.close_date::text || ' 00:00:00+00')::timestamptz ELSE NULL END
      )
      ON CONFLICT (employee_id, cycle_id) DO NOTHING;

      SELECT id INTO v_sheet_id FROM goal_sheets WHERE employee_id = user_row.id AND cycle_id = v_cycle_id;

      FOR tpl_row IN
        SELECT * FROM demo_goal_templates WHERE email = user_row.email ORDER BY sort_order
      LOOP
        v_score := CASE cycle_row.name
          WHEN 'FY2025-Q1' THEN 48
          WHEN 'FY2025-Q2' THEN 62
          WHEN 'FY2025-Q3' THEN 74
          WHEN 'FY2025-Q4' THEN 86
          ELSE 81
        END
        + CASE user_row.email
          WHEN 'admin@goalkeeper.com' THEN 6
          WHEN 'manager@goalkeeper.com' THEN 4
          WHEN 'employee@goalkeeper.com' THEN 0
          WHEN 'priya@goalkeeper.com' THEN 8
          ELSE -5
        END
        + (tpl_row.sort_order * 2);

        IF v_score > 100 THEN
          v_score := 100;
        ELSIF v_score < 0 THEN
          v_score := 0;
        END IF;

        INSERT INTO goals (goal_sheet_id, title, uom_type, target_value, weightage, thrust_area, description)
        VALUES (
          v_sheet_id,
          cycle_row.name || ' - ' || tpl_row.title,
          tpl_row.uom_type,
          tpl_row.target_value,
          tpl_row.weightage,
          tpl_row.thrust_area,
          tpl_row.title || ' for ' || cycle_row.name
        )
        RETURNING id INTO v_goal_id;

        INSERT INTO goal_achievements (goal_id, cycle_id, actual_value, score)
        VALUES (
          v_goal_id,
          v_cycle_id,
          CASE
            WHEN tpl_row.uom_type = 'Zero' THEN CASE WHEN v_score >= 90 THEN '0' ELSE '1' END
            WHEN tpl_row.uom_type = 'Percentage' THEN ROUND(v_score * 0.98)::TEXT
            ELSE ROUND((tpl_row.target_value::NUMERIC * v_score) / 100)::TEXT
          END,
          v_score
        )
        ON CONFLICT (goal_id, cycle_id) DO NOTHING;

        INSERT INTO check_ins (
          goal_id, cycle_id, employee_comment, manager_comment, employee_submitted_at, manager_submitted_at
        )
        VALUES (
          v_goal_id,
          v_cycle_id,
          user_row.email || ' update for ' || cycle_row.name || ' - ' || tpl_row.title,
          'Manager review for ' || tpl_row.title || ' in ' || cycle_row.name,
          (cycle_row.close_date::text || ' 09:00:00+00')::timestamptz,
          (cycle_row.close_date::text || ' 17:00:00+00')::timestamptz
        )
        ON CONFLICT (goal_id, cycle_id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  SELECT id INTO v_cycle_id FROM cycles WHERE name = 'FY2026-Q1';
  SELECT id INTO v_sheet_id FROM goal_sheets WHERE employee_id = v_mgr_id AND cycle_id = v_cycle_id;
  INSERT INTO goals (goal_sheet_id, title, uom_type, target_value, weightage, thrust_area, description)
  VALUES (v_sheet_id, 'FY2026-Q1 - Launch Enterprise Upsell Playbook', 'Numeric', '8', 20, 'Revenue Growth', 'A shared team goal with synced progress across recipients.')
  RETURNING id INTO v_shared_source_id;

  INSERT INTO goals (goal_sheet_id, title, uom_type, target_value, weightage, thrust_area, description)
  VALUES (v_sheet_id, 'FY2026-Q1 - Launch Enterprise Upsell Playbook', 'Numeric', '8', 20, 'Revenue Growth', 'A shared team goal with synced progress across recipients.')
  RETURNING id INTO v_shared_linked_id;

  INSERT INTO shared_goals (source_goal_id, linked_goal_id, target_employee_id, primary_owner_id)
  VALUES
    (v_shared_source_id, v_shared_source_id, v_mgr_id, v_mgr_id),
    (v_shared_source_id, v_shared_linked_id, v_ravi_id, v_mgr_id);

  INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES
    (v_mgr_id, 'APPROVED', 'goal_sheet', (SELECT id FROM goal_sheets WHERE employee_id = v_employee_id AND cycle_id = v_cycle_id), 'Approved FY2026-Q1 sheet for Eric Employee'),
    (v_employee_id, 'SUBMITTED', 'goal_sheet', (SELECT id FROM goal_sheets WHERE employee_id = v_employee_id AND cycle_id = v_cycle_id), 'Submitted FY2026-Q1 sheet'),
    (v_employee_id, 'CHECK_IN', 'goal', (SELECT id FROM goals WHERE goal_sheet_id = (SELECT id FROM goal_sheets WHERE employee_id = v_employee_id AND cycle_id = v_cycle_id) ORDER BY id LIMIT 1), 'Submitted Q1 check-in actuals');

  INSERT INTO escalation_rules (trigger_type, threshold_days, action, is_active) VALUES
    ('DRAFT_OVERDUE', 5, 'NOTIFY_EMPLOYEE', true),
    ('APPROVAL_OVERDUE', 3, 'NOTIFY_MANAGER', true),
    ('CHECKIN_OVERDUE', 7, 'NOTIFY_MANAGER', true);

END $$;

SELECT 'Setup complete! Tables created and seeded.' as status;
