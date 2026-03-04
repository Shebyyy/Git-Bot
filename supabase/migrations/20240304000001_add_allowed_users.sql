-- Create allowed_users table
CREATE TABLE IF NOT EXISTS allowed_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  username TEXT,
  added_by TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service role can manage allowed users"
  ON allowed_users
  FOR ALL
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read allowed users"
  ON allowed_users
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index
CREATE INDEX IF NOT EXISTS idx_allowed_users_discord_id ON allowed_users(discord_user_id);

-- Add comment
COMMENT ON TABLE allowed_users IS 'List of Discord users authorized to use the bot';
COMMENT ON COLUMN allowed_users.discord_user_id IS 'Discord user ID (snowflake)';
COMMENT ON COLUMN allowed_users.added_by IS 'Discord user ID who added this user';
