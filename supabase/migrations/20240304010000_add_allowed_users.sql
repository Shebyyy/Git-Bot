-- Create allowed_users table
CREATE TABLE IF NOT EXISTS allowed_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  discord_username TEXT,
  added_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
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

-- Add the two allowed users
INSERT INTO allowed_users (discord_user_id, discord_username, added_by)
VALUES 
  ('523539866311720963', 'Itsmechinmoy', '523539866311720963'),
  ('535831876766793738', 'RyanYuuki', '523539866311720963')
ON CONFLICT (discord_user_id) DO NOTHING;

-- Add comments
COMMENT ON TABLE allowed_users IS 'Users authorized to use the Discord bot';
COMMENT ON COLUMN allowed_users.discord_user_id IS 'Discord user ID';
COMMENT ON COLUMN allowed_users.discord_username IS 'Discord username (for reference)';
COMMENT ON COLUMN allowed_users.added_by IS 'Discord user ID who added this user';
COMMENT ON COLUMN allowed_users.is_active IS 'Whether this user is currently authorized';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_allowed_users_discord_id ON allowed_users(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_allowed_users_is_active ON allowed_users(is_active);
