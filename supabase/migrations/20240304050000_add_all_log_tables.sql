-- Create all logging tables for audit trails

-- User operations log
CREATE TABLE IF NOT EXISTS user_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  target_user_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('add', 'remove', 'promote', 'demote')),
  old_role TEXT,
  new_role TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Release operations log
CREATE TABLE IF NOT EXISTS release_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  tag_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'delete')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Issue operations log
CREATE TABLE IF NOT EXISTS issue_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  issue_number INTEGER,
  action TEXT NOT NULL CHECK (action IN ('create', 'close', 'comment')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Branch operations log
CREATE TABLE IF NOT EXISTS branch_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  branch_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'delete', 'protect', 'unprotect')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PR operations log (enhanced)
CREATE TABLE IF NOT EXISTS pr_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  pr_number INTEGER,
  action TEXT NOT NULL CHECK (action IN ('merge', 'review', 'approve', 'close', 'view')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Label operations log
CREATE TABLE IF NOT EXISTS label_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  label_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'delete')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Repository operations log
CREATE TABLE IF NOT EXISTS repo_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  repo_alias TEXT,
  owner TEXT,
  repo_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('add', 'remove', 'switch')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook operations log
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  webhook_id INTEGER,
  webhook_url TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'delete')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collaborator operations log
CREATE TABLE IF NOT EXISTS collaborator_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  username TEXT,
  action TEXT NOT NULL CHECK (action IN ('add', 'remove')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Milestone operations log
CREATE TABLE IF NOT EXISTS milestone_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  milestone_number INTEGER,
  action TEXT NOT NULL CHECK (action IN ('create', 'close')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for all log tables
CREATE INDEX IF NOT EXISTS idx_user_logs_triggered_by ON user_logs(triggered_by);
CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON user_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_logs_created_at ON release_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_logs_created_at ON issue_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branch_logs_created_at ON branch_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_logs_created_at ON pr_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_label_logs_created_at ON label_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repo_logs_created_at ON repo_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collaborator_logs_created_at ON collaborator_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_milestone_logs_created_at ON milestone_logs(created_at DESC);

-- Add comments
COMMENT ON TABLE user_logs IS 'User management operations audit log';
COMMENT ON TABLE release_logs IS 'Release operations audit log';
COMMENT ON TABLE issue_logs IS 'Issue operations audit log';
COMMENT ON TABLE branch_logs IS 'Branch operations audit log';
COMMENT ON TABLE pr_logs IS 'Pull request operations audit log';
COMMENT ON TABLE label_logs IS 'Label operations audit log';
COMMENT ON TABLE repo_logs IS 'Repository operations audit log';
COMMENT ON TABLE webhook_logs IS 'Webhook operations audit log';
COMMENT ON TABLE collaborator_logs IS 'Collaborator operations audit log';
COMMENT ON TABLE milestone_logs IS 'Milestone operations audit log';
