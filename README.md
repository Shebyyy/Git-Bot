# Discord GitHub Bot

A powerful Discord bot for managing GitHub fork repositories via slash commands, built with **Supabase Edge Functions** (serverless, free forever), Discord.js, and GitHub REST API.

## Features

- **🔄 Sync**: Automatically sync your fork with upstream repository (non-destructive merge)
- **🏷️ Tags**: List, create, and delete repository tags
- **🌿 Branches**: View all branches with protection status
- **📋 Pull Requests**: List and view detailed PR information
- **📊 Logging**: All operations logged to Supabase PostgreSQL for audit

## Tech Stack

- **Discord.js** - Slash commands and interactions
- **Supabase Edge Functions** - Serverless functions (Deno/TypeScript)
- **GitHub REST API** - Repository management
- **Supabase PostgreSQL** - Operation logging with RLS

## Project Structure

```
.
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   └── utils.ts              # Shared utilities (auth, API requests, logging)
│   │   ├── sync/
│   │   │   └── index.ts              # /sync command
│   │   ├── tags/
│   │   │   └── index.ts              # /tags command (list, create, delete)
│   │   ├── branches/
│   │   │   └── index.ts              # /branches command
│   │   └── prs/
│   │       └── index.ts              # /prs command (list, view)
│   ├── schema.sql                     # Database schema (sync_logs, tag_logs)
│   └── config.json                    # Supabase configuration
├── scripts/
│   └── register-commands.js           # Discord command registration
├── .env.example                       # Environment variables template
├── package.json                       # Node.js dependencies
└── README.md                          # This file
```

## Prerequisites

- Node.js 18+ and npm
- Supabase CLI (install via `npm install -g supabase`)
- GitHub account with forked repository
- Discord Developer account (free)

## Setup Guide

### 1. Discord Bot Setup

1. **Create Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application"
   - Give it a name (e.g., "GitHub Bot")
   - Click "Create"

2. **Create Bot User**
   - Navigate to "Bot" tab
   - Click "Add Bot" → "Yes, do it!"
   - Enable "MESSAGE CONTENT INTENT"
   - Enable "SERVER MEMBERS INTENT" (optional, for future features)
   - Copy the **BOT TOKEN** - save it for later

3. **Get Application Credentials**
   - Navigate to "General Information" tab
   - Copy the **APPLICATION ID** (CLIENT_ID)
   - Copy the **PUBLIC KEY**

4. **Get Guild ID** (for testing - faster command updates)
   - Enable Developer Mode in Discord (User Settings → Advanced)
   - Right-click your server → Copy Server ID (GUILD_ID)

### 2. GitHub Personal Access Token Setup

1. **Create GitHub PAT**
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Give it a descriptive name
   - Select scopes:
     - `repo` (full control of private repos)
     - `public_repo` (if working with public repos only)
   - Click "Generate token"
   - **Copy the token immediately** - you won't see it again!

2. **Verify Fork Setup**
   - Ensure you have forked the upstream repository
   - Note the fork owner and repository name
   - Note the upstream owner and repository name

### 3. Supabase Project Setup

1. **Create Supabase Project**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Click "New Project"
   - Choose organization (or create free one)
   - Set project name (e.g., "discord-github-bot")
   - Set database password (save it!)
   - Choose region closest to you
   - Click "Create new project" (takes 1-2 minutes)

2. **Get Project Credentials**
   - Go to Project Settings → API
   - Copy the **Project URL** (SUPABASE_URL)
   - Copy the **service_role secret** (SUPABASE_SERVICE_ROLE_KEY)
   - ⚠️ **Never share the service_role key** - it has full database access!

3. **Apply Database Schema**
   ```bash
   # Navigate to project directory
   cd Git-Bot
   
   # Link to your Supabase project (optional, for local dev)
   supabase link --project-ref YOUR_PROJECT_ID
   
   # Apply the schema
   supabase db push
   
   # Or manually via Supabase Dashboard:
   # - Go to SQL Editor in Supabase Dashboard
   # - Copy contents of supabase/schema.sql
   # - Paste and run
   ```

### 4. Project Installation

```bash
# Clone the repository (if not already done)
git clone https://github.com/Shebyyy/Git-Bot.git
cd Git-Bot

# Install dependencies
npm install
```

### 5. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

Fill in all the variables:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_PUBLIC_KEY=your_discord_public_key_here
DISCORD_CLIENT_ID=your_discord_application_id_here
DISCORD_GUILD_ID=your_guild_id_for_testing  # Optional, but recommended

# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token_here
GITHUB_OWNER=Shebyyy
GITHUB_REPO=AnymeX
UPSTREAM_OWNER=RyanYuuki
UPSTREAM_REPO=AnymeX
UPSTREAM_BRANCH=main
TARGET_BRANCH=beta

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

### 6. Register Discord Slash Commands

```bash
# Register commands (guild-specific for instant updates)
npm run register-commands
```

If `DISCORD_GUILD_ID` is set, commands will be available immediately in that guild.
If not, global commands may take up to 1 hour to propagate.

### 7. Deploy to Supabase Edge Functions

```bash
# Login to Supabase CLI (first time only)
supabase login

# Link to your project (if not done earlier)
supabase link --project-ref YOUR_PROJECT_ID

# Deploy all edge functions
supabase functions deploy sync
supabase functions deploy tags
supabase functions deploy branches
supabase functions deploy prs

# Or deploy all at once
supabase functions deploy
```

### 8. Configure Supabase Secrets

```bash
# Set Discord secrets
supabase secrets set DISCORD_TOKEN=your_discord_bot_token
supabase secrets set DISCORD_PUBLIC_KEY=your_discord_public_key
supabase secrets set DISCORD_CLIENT_ID=your_discord_client_id

# Set GitHub secrets
supabase secrets set GITHUB_TOKEN=your_github_pat
supabase secrets set GITHUB_OWNER=Shebyyy
supabase secrets set GITHUB_REPO=AnymeX
supabase secrets set UPSTREAM_OWNER=RyanYuuki
supabase secrets set UPSTREAM_REPO=AnymeX
supabase secrets set UPSTREAM_BRANCH=main
supabase secrets set TARGET_BRANCH=beta

# Set Supabase secrets
supabase secrets set SUPABASE_URL=your_supabase_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 9. Setup Interaction Endpoint

1. **Get Function URLs**
   - Go to Supabase Dashboard → Edge Functions
   - Copy the URL for each function

2. **Configure Discord Interaction Endpoint**
   - Go back to Discord Developer Portal
   - Navigate to your application
   - Go to "General Information" → "INTERACTIONS ENDPOINT URL"
   - Set it to: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync`
   - Note: Discord will send all slash commands to this endpoint, which will route to the appropriate function

3. **Alternative: Use a single entry point** (recommended)
   - Create a router function that forwards to appropriate function based on command name
   - Or deploy all functions and set Discord interaction endpoint to any one of them (they all handle their respective commands)

### 10. Invite Bot to Server

1. **Generate OAuth2 URL**
   - Go to Discord Developer Portal → OAuth2 → URL Generator
   - Select scopes:
     - `bot`
     - `applications.commands`
   - Select bot permissions:
     - `Send Messages`
     - `Embed Links`
     - `Use Slash Commands`
   - Copy the generated URL

2. **Invite Bot**
   - Open the URL in your browser
   - Select your server
   - Click "Authorize"
   - Complete the verification

## Usage

Once everything is set up, use the following commands in Discord:

### `/sync`
Sync your fork with the upstream repository (non-destructive merge)

**Example:**
```
/sync
```

**Response:** Shows sync status, upstream SHA, merge SHA, and any conflicts

### `/tags list`
List the latest 15 tags in the repository

**Example:**
```
/tags list
```

### `/tags create <name> [message]`
Create a new tag on the latest commit of the target branch

**Example:**
```
/tags create v1.0.0 "First stable release"
```

### `/tags delete <name>`
Delete a tag from the repository

**Example:**
```
/tags delete v0.9.0
```

### `/branches`
List all branches with protection status (🔒 = protected, 🔓 = not protected)

**Example:**
```
/branches
```

### `/prs list [state]`
List pull requests (default: open)

**Examples:**
```
/prs list
/prs list state:closed
/prs list state:all
```

### `/prs view <number>`
View detailed information about a specific pull request

**Example:**
```
/prs view 42
```

**Response:** Shows status, commits, additions/deletions, changed files, reviewers, labels, description, and URL

## Database Schema

### sync_logs
Tracks all sync operations between upstream and fork.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| triggered_by | TEXT | Discord user ID |
| upstream_sha | TEXT | Upstream commit SHA |
| merge_sha | TEXT | Merge commit SHA |
| status | TEXT | success/conflict/error/already_up_to_date |
| error_message | TEXT | Error details (if any) |
| created_at | TIMESTAMP | Operation timestamp |

### tag_logs
Tracks all tag create and delete operations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| triggered_by | TEXT | Discord user ID |
| tag_name | TEXT | Tag name |
| tag_sha | TEXT | Tag object SHA |
| commit_sha | TEXT | Commit SHA the tag points to |
| action | TEXT | create/delete |
| status | TEXT | success/error |
| error_message | TEXT | Error details (if any) |
| created_at | TIMESTAMP | Operation timestamp |

## Security Features

- **Ed25519 Signature Verification**: All Discord requests are cryptographically verified
- **Row Level Security (RLS)**: Database tables have RLS policies enabled
- **Service Role Isolation**: Sensitive operations require service role key
- **No Force Operations**: All operations are non-destructive (merge only, never force push)
- **Conflict Detection**: Automatically detects merge conflicts and notifies users

## Monitoring & Logs

### View Supabase Logs
```bash
# View function logs
supabase functions logs sync
supabase functions logs tags
supabase functions logs branches
supabase functions logs prs

# Follow logs in real-time
supabase functions logs --follow
```

### View Database Records
1. Go to Supabase Dashboard → Table Editor
2. View `sync_logs` and `tag_logs` tables
3. Filter by status, date, or user ID

## Troubleshooting

### Commands not appearing
- Ensure you registered commands: `npm run register-commands`
- Check if `DISCORD_GUILD_ID` is set (for instant updates)
- Wait up to 1 hour for global command propagation

### Bot not responding
- Check Supabase Edge Function logs
- Verify interaction endpoint URL is correct
- Ensure all secrets are set correctly
- Check Discord bot has necessary permissions

### Sync conflicts
- The bot will notify you of conflicts
- Resolve manually using Git:
  ```bash
  git fetch upstream
  git checkout beta
  git merge upstream/main
  # Resolve conflicts
  git push
  ```

### GitHub API rate limits
- Free tier: 5000 requests/hour (authenticated)
- If hitting limits, consider implementing caching
- Check token has proper scopes

### Edge Function errors
- Verify all environment secrets are set
- Check function logs for detailed error messages
- Ensure Deno imports are correct and up-to-date

## Cost

- **Supabase Free Tier**: 500MB database, 1GB file storage, 2GB bandwidth/month
- **Discord**: Free for developers
- **GitHub**: Free for public repos, $0 for PAT usage
- **Total**: $0/month (free forever within limits)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own bots!

## Support

For issues and questions:
1. Check the Troubleshooting section
2. Review Supabase Edge Function logs
3. Open an issue on GitHub

## Future Enhancements

- Webhook support for real-time PR notifications
- Automatic sync scheduling
- Multiple repository support
- Role-based command access control
- Custom command aliases
- Rich command suggestions and autocomplete

---

**Built with ❤️ using Supabase Edge Functions**
