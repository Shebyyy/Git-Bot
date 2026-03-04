-- Add role column to allowed_users table
ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user'));

-- Update existing users with their roles
UPDATE allowed_users SET role = 'owner' WHERE discord_user_id = '612532963938271232'; -- Shebyyy
UPDATE allowed_users SET role = 'user' WHERE discord_user_id = '523539866311720963'; -- Itsmechinmoy
UPDATE allowed_users SET role = 'user' WHERE discord_user_id = '535831876766793738'; -- RyanYuuki

-- Add comment
COMMENT ON COLUMN allowed_users.role IS 'User role: owner (full control), admin (can manage users), user (bot commands only)';
