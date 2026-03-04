# Quick Start Guide

Get your Discord GitHub Bot up and running in 10 minutes!

## 1️⃣ Install Dependencies

```bash
cd Git-Bot
npm install
```

## 2️⃣ Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_CLIENT_ID` (from Discord Developer Portal)
- `GITHUB_TOKEN` (from GitHub → Settings → Developer settings → PAT)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from Supabase Dashboard)

## 3️⃣ Register Discord Commands

```bash
npm run register-commands
```

## 4️⃣ Deploy to Supabase

```bash
# Login (first time only)
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_ID

# Set secrets
supabase secrets set DISCORD_TOKEN=your_token
supabase secrets set DISCORD_PUBLIC_KEY=your_key
supabase secrets set DISCORD_CLIENT_ID=your_client_id
supabase secrets set GITHUB_TOKEN=your_github_token
supabase secrets set GITHUB_OWNER=Shebyyy
supabase secrets set GITHUB_REPO=AnymeX
supabase secrets set UPSTREAM_OWNER=RyanYuuki
supabase secrets set UPSTREAM_REPO=AnymeX
supabase secrets set UPSTREAM_BRANCH=main
supabase secrets set TARGET_BRANCH=beta
supabase secrets set SUPABASE_URL=your_supabase_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Deploy functions
supabase functions deploy
```

## 5️⃣ Setup Database

Option 1: Via Supabase CLI
```bash
supabase db push
```

Option 2: Via Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/schema.sql`
3. Paste and run

## 6️⃣ Invite Bot to Discord

1. Go to Discord Developer Portal → OAuth2 → URL Generator
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
4. Copy URL, open in browser, authorize

## 7️⃣ Test It!

In Discord, try:
```
/sync
/tags list
/branches
/prs list
```

## Need Help?

See the full [README.md](README.md) for detailed setup instructions and troubleshooting.
