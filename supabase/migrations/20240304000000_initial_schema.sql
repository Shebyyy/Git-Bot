-- Enable UUID extension (for older Postgres versions)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  upstream_sha TEXT,
  merge_sha TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'conflict', 'error', 'already_up_to_date')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tag_logs table
CREATE TABLE IF NOT EXISTS tag_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  tag_name TEXT,
  tag_sha TEXT,
  commit_sha TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'delete')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for sync_logs
-- Allow service role to insert and read
CREATE POLICY "Service role can insert sync logs"
  ON sync_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read sync logs"
  ON sync_logs
  FOR SELECT
  TO service_role
  USING (true);

-- Allow authenticated users to read sync logs (for audit purposes)
CREATE POLICY "Authenticated users can read sync logs"
  ON sync_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for tag_logs
-- Allow service role to insert and read
CREATE POLICY "Service role can insert tag logs"
  ON tag_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read tag logs"
  ON tag_logs
  FOR SELECT
  TO service_role
  USING (true);

-- Allow authenticated users to read tag logs (for audit purposes)
CREATE POLICY "Authenticated users can read tag logs"
  ON tag_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_triggered_by ON sync_logs(triggered_by);

CREATE INDEX IF NOT EXISTS idx_tag_logs_created_at ON tag_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tag_logs_action ON tag_logs(action);
CREATE INDEX IF NOT EXISTS idx_tag_logs_tag_name ON tag_logs(tag_name);
CREATE INDEX IF NOT EXISTS idx_tag_logs_triggered_by ON tag_logs(triggered_by);

-- Add comments for documentation
COMMENT ON TABLE sync_logs IS 'Logs of all sync operations from upstream to fork';
COMMENT ON TABLE tag_logs IS 'Logs of all tag create and delete operations';

COMMENT ON COLUMN sync_logs.triggered_by IS 'Discord user ID who triggered the sync';
COMMENT ON COLUMN sync_logs.upstream_sha IS 'SHA of the upstream commit being synced';
COMMENT ON COLUMN sync_logs.merge_sha IS 'SHA of the merge commit (if successful)';
COMMENT ON COLUMN sync_logs.status IS 'Status of the sync operation';

COMMENT ON COLUMN tag_logs.triggered_by IS 'Discord user ID who triggered the tag operation';
COMMENT ON COLUMN tag_logs.tag_name IS 'Name of the tag';
COMMENT ON COLUMN tag_logs.tag_sha IS 'SHA of the tag object';
COMMENT ON COLUMN tag_logs.commit_sha IS 'SHA of the commit the tag points to';
COMMENT ON COLUMN tag_logs.action IS 'Type of tag operation (create or delete)';
COMMENT ON COLUMN tag_logs.status IS 'Status of the tag operation';
