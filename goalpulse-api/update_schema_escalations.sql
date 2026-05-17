-- Migration: Add Escalation Engine tables

CREATE TABLE IF NOT EXISTS escalation_rules (
    id SERIAL PRIMARY KEY,
    trigger_type VARCHAR(100) NOT NULL, -- e.g., 'DRAFT_OVERDUE', 'APPROVAL_OVERDUE', 'CHECKIN_OVERDUE'
    threshold_days INTEGER NOT NULL DEFAULT 3,
    action VARCHAR(100) NOT NULL DEFAULT 'NOTIFY_MANAGER',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS escalation_events (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES escalation_rules(id) ON DELETE CASCADE,
    entity_id INTEGER NOT NULL, -- The ID of the goal sheet
    assignee_id INTEGER REFERENCES users(id), -- The user responsible for resolving
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default rules
INSERT INTO escalation_rules (trigger_type, threshold_days, action, is_active) VALUES
('DRAFT_OVERDUE', 5, 'NOTIFY_EMPLOYEE', true),
('APPROVAL_OVERDUE', 3, 'NOTIFY_MANAGER', true),
('CHECKIN_OVERDUE', 7, 'NOTIFY_MANAGER', true);
