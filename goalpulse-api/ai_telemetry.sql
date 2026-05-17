-- Migration: Add AI Telemetry persistence

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
