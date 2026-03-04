-- Drop existing table and recreate with role support
DROP TABLE IF EXISTS allowed_users CASCADE;

-- Create allowed_users table with role column
CREATE TABLE allowed_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  added_by TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

-- Create policies for allowed_users
CREATE POLICY "Service role can manage allowed users"
  ON allowed_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read allowed users"
  ON allowed_users
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert users with correct roles
INSERT INTO allowed_users (discord_user_id, username, added_by, role)
VALUES 
  ('612532963938271232', 'Shebyyy', 'system', 'owner'),
  ('523539866311720963', 'Itsmechinmoy', '612532963938271232', 'user'),
  ('535831876766793738', 'RyanYuuki', '612532963938271232', 'user');

-- Add comments
COMMENT ON TABLE allowed_users IS 'Users authorized to use the Discord bot with role-based access';
COMMENT ON COLUMN allowed_users.discord_user_id IS 'Discord user ID';
COMMENT ON COLUMN allowed_users.username IS 'Discord username';
COMMENT ON COLUMN allowed_users.added_by IS 'Discord user ID who added this user';
COMMENT ON COLUMN allowed_users.role IS 'User role: owner (full control), admin (can manage users), user (bot commands only)';
COMMENT ON COLUMN allowed_users.is_active IS 'Whether this user is currently authorized';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_allowed_users_discord_id ON allowed_users(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_allowed_users_role ON allowed_users(role);
CREATE INDEX IF NOT EXISTS idx_allowed_users_is_active ON allowed_users(is_active);
