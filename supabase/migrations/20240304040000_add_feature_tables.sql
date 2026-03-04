-- Scheduled tasks table
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL CHECK (task_type IN ('sync', 'release', 'custom')),
  schedule TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE
);

-- Multi-repository support
CREATE TABLE IF NOT EXISTS repositories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alias TEXT NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  added_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bot settings
CREATE TABLE IF NOT EXISTS bot_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO bot_settings (key, value)
VALUES 
  ('default_repository', jsonb_build_object('owner', 'Shebyyy', 'repo', 'AnymeX')),
  ('schedule_enabled', jsonb_build_object('enabled', false))
ON CONFLICT (key) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_type ON scheduled_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_repositories_alias ON repositories(alias);
CREATE INDEX IF NOT EXISTS idx_repositories_active ON repositories(is_active);

-- Add comments
COMMENT ON TABLE scheduled_tasks IS 'Automated scheduled tasks like daily sync';
COMMENT ON TABLE repositories IS 'Multiple repository support';
COMMENT ON TABLE bot_settings IS 'Bot configuration and settings';
