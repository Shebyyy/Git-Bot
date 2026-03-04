# Troubleshooting Guide

Common issues and their solutions.

## Commands Not Appearing

### Problem: Slash commands don't show up in Discord

**Solutions:**
1. Ensure you ran: `npm run register-commands`
2. Check that `.env` contains `DISCORD_CLIENT_ID` and `DISCORD_TOKEN`
3. If using global commands (no guild ID), wait up to 1 hour for propagation
4. Set `DISCORD_GUILD_ID` in `.env` for instant updates during development

### Problem: Command appears but bot doesn't respond

**Solutions:**
1. Check Supabase Edge Function logs: `supabase functions logs --follow`
2. Verify interaction endpoint URL is set in Discord Developer Portal
3. Ensure all secrets are set: `supabase secrets list`
4. Check bot has "Send Messages" permission in the server

## GitHub Issues

### Problem: "Bad credentials" error

**Solutions:**
1. Verify `GITHUB_TOKEN` is correct
2. Check token has `repo` scope
3. Regenerate PAT if needed

### Problem: Merge conflicts during sync

**Solutions:**
1. Bot will notify you of conflicts - this is expected behavior
2. Resolve manually:
   ```bash
   git fetch upstream
   git checkout beta
   git merge upstream/main
   # Resolve conflicts in files
   git add .
   git commit -m "Resolve merge conflicts"
   git push
   ```
3. Re-run `/sync` after resolving

### Problem: Rate limit errors

**Solutions:**
1. GitHub allows 5,000 requests/hour with authentication
2. Check if you're hitting limits
3. Wait for rate limit to reset (hourly)

## Supabase Issues

### Problem: "Invalid signature" error

**Solutions:**
1. Verify `DISCORD_PUBLIC_KEY` is correct
2. Ensure you copied the Public Key, not the Client ID
3. Check for extra spaces in environment variable

### Problem: Database connection errors

**Solutions:**
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. Ensure database schema is applied: check `sync_logs` and `tag_logs` tables exist
3. Check RLS policies are enabled (should be by default in schema.sql)

### Problem: Secrets not working

**Solutions:**
1. List secrets: `supabase secrets list`
2. Re-set missing secrets: `supabase secrets set KEY=value`
3. Redeploy functions after setting secrets: `supabase functions deploy`

## Deployment Issues

### Problem: Function deployment fails

**Solutions:**
1. Ensure you're logged in: `supabase login`
2. Check project is linked: `supabase status`
3. Verify function files exist in `supabase/functions/`
4. Check for TypeScript syntax errors

### Problem: Functions deployed but not working

**Solutions:**
1. View function logs: `supabase functions logs FUNCTION_NAME --follow`
2. Check all environment variables are set
3. Verify function URL is correct
4. Test function directly via curl

## Discord Bot Issues

### Problem: Bot offline in server

**Solutions:**
1. Check if Discord bot is running (Edge Functions are always-on)
2. Verify bot hasn't been kicked from server
3. Check Discord service status (status.discord.com)

### Problem: Bot missing permissions

**Solutions:**
1. Re-authorize bot with correct scopes
2. Check server role permissions
3. Ensure bot has "Send Messages", "Embed Links", "Use Slash Commands"

## Environment Variables

### Problem: `.env` file not being read

**Solutions:**
1. Ensure `.env` is in project root
2. Check file is named `.env` (not `.env.txt`)
3. Verify no syntax errors (no quotes around values unless needed)
4. For register-commands script, variables are loaded via dotenv

## Testing

### Test Command Registration

```bash
# Check if commands are registered
npm run register-commands
# Should show "Successfully reloaded X application (/) commands"
```

### Test Function Deployment

```bash
# Check function status
supabase functions list

# Test specific function
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync \
  -H 'Content-Type: application/json' \
  -d '{"test": true}'
```

### Test Database Connection

```bash
# Via Supabase Dashboard → SQL Editor
SELECT COUNT(*) FROM sync_logs;
SELECT COUNT(*) FROM tag_logs;
```

## Getting More Help

1. **Check logs first**: `supabase functions logs --follow`
2. **Review README.md**: Full setup guide
3. **Check Discord Developer Portal**: Verify all settings
4. **Check Supabase Dashboard**: Verify project status and logs
5. **Check GitHub**: Verify token scopes and permissions

## Common Error Messages

### "401 Unauthorized"
- Authentication issue
- Check Discord token or GitHub token

### "403 Forbidden"
- Permission issue
- Check bot permissions in Discord
- Check token scopes in GitHub

### "404 Not Found"
- Resource not found
- Check repository owner/name are correct
- Verify branch names

### "409 Conflict"
- Merge conflict
- Expected behavior - resolve manually
- Follow merge conflict instructions above

### "429 Too Many Requests"
- Rate limited
- Wait and retry
- Consider implementing caching

### "500 Internal Server Error"
- Server error
- Check function logs
- Verify all environment variables are set

## Still Having Issues?

1. Enable debug logging in functions
2. Check all environment variables one more time
3. Try deploying a simple test function
4. Review Supabase project logs
5. Check Discord Developer Portal for any warnings
