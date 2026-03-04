import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Environment variables
const DISCORD_PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY') || ''
const DISCORD_TOKEN = Deno.env.get('DISCORD_TOKEN') || ''
const DISCORD_CLIENT_ID = Deno.env.get('DISCORD_CLIENT_ID') || ''
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || ''
const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER') || 'Shebyyy'
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') || 'AnymeX'
const UPSTREAM_OWNER = Deno.env.get('UPSTREAM_OWNER') || 'RyanYuuki'
const UPSTREAM_REPO = Deno.env.get('UPSTREAM_REPO') || 'AnymeX'
const UPSTREAM_BRANCH = Deno.env.get('UPSTREAM_BRANCH') || 'main'
const TARGET_BRANCH = Deno.env.get('TARGET_BRANCH') || 'beta'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const ALLOWED_USERS = Deno.env.get('ALLOWED_USERS') || ''

// User roles
type UserRole = 'owner' | 'admin' | 'user'

interface User {
  discord_user_id: string
  username: string
  role: UserRole
  created_at: string
}

interface Repository {
  alias: string
  owner: string
  name: string
  created_at: string
}

/**
 * Check if a user is authorized to use the bot
 */
async function isUserAuthorized(userId: string): Promise<boolean> {
  const allowedFromEnv = ALLOWED_USERS.split(',').map(id => id.trim()).filter(id => id)
  if (allowedFromEnv.includes(userId)) {
    console.log('User authorized via environment variable:', userId)
    return true
  }
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?discord_user_id=eq.${userId}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      console.log('User authorized via database:', userId)
      return true
    }
  } catch (error) {
    console.error('Error checking authorization:', error)
  }
  
  console.log('User NOT authorized:', userId)
  return false
}

/**
 * Get user role from database
 */
async function getUserRole(userId: string): Promise<UserRole> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?discord_user_id=eq.${userId}&select=role`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      return data[0].role || 'user'
    }
  } catch (error) {
    console.error('Error getting user role:', error)
  }
  
  return 'user'
}

/**
 * Check if user has required role (owner or admin)
 */
async function hasAdminRole(userId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === 'owner' || role === 'admin'
}

/**
 * Check if user is owner
 */
async function isOwner(userId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === 'owner'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Signature-Ed25519, X-Signature-Timestamp',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('X-Signature-Ed25519')
    const timestamp = req.headers.get('X-Signature-Timestamp')

    if (!signature || !timestamp || !DISCORD_PUBLIC_KEY) {
      return new Response('Missing required headers', { status: 401 })
    }

    const message = `${timestamp}${body}`
    const messageBytes = new TextEncoder().encode(message)

    const signatureBytes = new Uint8Array(signature.length / 2)
    for (let i = 0; i < signature.length; i += 2) {
      signatureBytes[i / 2] = parseInt(signature.substring(i, i + 2), 16)
    }

    const publicKeyBytes = new Uint8Array(DISCORD_PUBLIC_KEY.length / 2)
    for (let i = 0; i < DISCORD_PUBLIC_KEY.length; i += 2) {
      publicKeyBytes[i / 2] = parseInt(DISCORD_PUBLIC_KEY.substring(i, i + 2), 16)
    }

    const publicKeyObj = await crypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify']
    )

    const isValid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKeyObj,
      signatureBytes,
      messageBytes
    )

    if (!isValid) {
      return new Response('Invalid signature', { status: 401 })
    }

    const interaction = JSON.parse(body)

    // Handle PING
    if (interaction.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Handle APPLICATION_COMMAND
    if (interaction.type === 2) {
      const commandName = interaction.data.name
      const userId = interaction.user?.id || interaction.member?.user?.id
      const interactionToken = interaction.token

      const response = { type: 5 }
      processCommand(commandName, interaction.data.options, interactionToken, userId)
      
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('Unknown interaction', { status: 400 })

  } catch (error) {
    console.error('Error:', error)
    return new Response(`Error: ${error.message}`, { status: 500 })
  }
})

async function processCommand(commandName: string, options: any[], token: string, userId: string) {
  try {
    const authorized = await isUserAuthorized(userId)
    if (!authorized) {
      await sendFollowUp(token, '[Error] You are not authorized to use this bot. Contact the bot owner for access.')
      return
    }
    
    let content = ''
    
    // Existing features
    if (commandName === 'sync') {
      content = await handleSync(userId)
    } else if (commandName === 'tags') {
      const subcommand = options?.[0]?.name
      content = await handleTags(subcommand, options?.[0]?.options, userId)
    } else if (commandName === 'branches') {
      const subcommand = options?.[0]?.name || 'list'
      content = await handleBranches(subcommand, options?.[0]?.options, userId)
    } else if (commandName === 'prs') {
      const subcommand = options?.[0]?.name
      content = await handlePRs(subcommand, options?.[0]?.options, userId)
    }
    // User Management
    else if (commandName === 'users') {
      content = await handleUsers(options?.[0]?.name, options?.[0]?.options, userId)
    }
    // Release Management
    else if (commandName === 'releases') {
      content = await handleReleases(options?.[0]?.name, options?.[0]?.options, userId)
    }
    // Issue Management
    else if (commandName === 'issues') {
      content = await handleIssues(options?.[0]?.name, options?.[0]?.options, userId)
    }
    // Commit History
    else if (commandName === 'commits') {
      content = await handleCommits(options?.[0]?.name, options?.[0]?.options)
    }
    // Scheduled Tasks
    else if (commandName === 'schedule') {
      content = await handleSchedule(options?.[0]?.name, options?.[0]?.options, userId)
    }
    // File Operations
    else if (commandName === 'files') {
      content = await handleFiles(options?.[0]?.name, options?.[0]?.options)
    }
    // Statistics
    else if (commandName === 'stats') {
      content = await handleStats()
    }
    // Labels
    else if (commandName === 'labels') {
      content = await handleLabels(options?.[0]?.name, options?.[0]?.options, userId)
    }
    // Multi-Repo
    else if (commandName === 'repo') {
      content = await handleRepo(options?.[0]?.name, options?.[0]?.options, userId)
    }
    // Webhooks
    else if (commandName === 'webhook') {
      content = await handleWebhook(options?.[0]?.name, options?.[0]?.options, userId)
    }
    // Collaborators
    else if (commandName === 'collaborators') {
      content = await handleCollaborators(options?.[0]?.name, options?.[0]?.options, userId)
    }
    // Milestones
    else if (commandName === 'milestones') {
      content = await handleMilestones(options?.[0]?.name, options?.[0]?.options, userId)
    }
    // Search
    else if (commandName === 'search') {
      content = await handleSearch(options?.[0]?.name, options?.[0]?.options)
    }
    else {
      content = '[Unknown] Unknown command'
    }
    
    await sendFollowUp(token, content)
  } catch (error: any) {
    console.error(`Error processing ${commandName}:`, error)
    await sendFollowUp(token, `[Error] Error: ${error.message}`)
  }
}

// ==================== EXISTING FEATURES ====================

async function handleSync(userId: string): Promise<string> {
  console.log('Starting sync for user:', userId)
  
  const upstreamResp = await githubRequest(`/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/git/refs/heads/${UPSTREAM_BRANCH}`)
  const upstreamSha = upstreamResp.object.sha
  console.log('Upstream SHA:', upstreamSha.substring(0, 7))
  
  const forkResp = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${TARGET_BRANCH}`)
  const forkSha = forkResp.object.sha
  console.log('Fork SHA:', forkSha.substring(0, 7))
  
  const shortUpstream = upstreamSha.substring(0, 7)
  const shortFork = forkSha.substring(0, 7)
  
  try {
    const compare = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/compare/${forkSha}...${upstreamSha}`)
    
    if (compare.merge_base_commit && compare.merge_base_commit.sha === upstreamSha) {
      console.log('Upstream commit is already in fork history')
      await logToSupabase('sync_logs', {
        triggered_by: userId,
        upstream_sha: upstreamSha,
        merge_sha: forkSha,
        status: 'already_up_to_date',
      })
      
      return `[Success] Already up to date\n\n**Branch:** ${TARGET_BRANCH}\n**Upstream commit:** \`${shortUpstream}\` is already in your ${TARGET_BRANCH} branch\n**Current HEAD:** \`${shortFork}\``
    }
  } catch (e: any) {
    console.log('Compare API failed, continuing:', e.message)
  }
  
  if (upstreamSha === forkSha) {
    console.log('SHAs match - already synced')
    await logToSupabase('sync_logs', {
      triggered_by: userId,
      upstream_sha: upstreamSha,
      merge_sha: forkSha,
      status: 'already_up_to_date',
    })
    
    return `[Success] Already up to date\n\n**Branch:** ${TARGET_BRANCH}\n**Current SHA:** \`${shortFork}\``
  }
  
  console.log('Fork is behind upstream, attempting to sync...')
  
  try {
    const compare = await githubRequest(`/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/compare/${forkSha}...${upstreamSha}`)
    
    console.log(`Found ${compare.ahead_by} commits ahead`)
    console.log(`Files changed: ${compare.files?.length || 0}`)
    
    const conflicts = compare.files?.filter((f: any) => f.status === 'conflict')
    if (conflicts && conflicts.length > 0) {
      console.log('Merge conflicts detected:', conflicts.length)
      await logToSupabase('sync_logs', {
        triggered_by: userId,
        upstream_sha: upstreamSha,
        merge_sha: null,
        status: 'conflict',
      })
      
      return `[Warning] Merge conflict detected\n\n**Upstream SHA:** \`${shortUpstream}\`\n**Your SHA:** \`${shortFork}\`\n**Conflicting files:** ${conflicts.length}\n\nPlease resolve manually:\n\`\`\`git remote add upstream https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git\ngit fetch upstream\ngit checkout ${TARGET_BRANCH}\ngit merge upstream/${UPSTREAM_BRANCH}\n# Resolve conflicts\ngit push\`\`\``
    }
    
    if (compare.ahead_by === 0 && compare.behind_by > 0) {
      console.log('No commits ahead, but some behind - likely already merged')
      await logToSupabase('sync_logs', {
        triggered_by: userId,
        upstream_sha: upstreamSha,
        merge_sha: forkSha,
        status: 'already_up_to_date',
      })
      
      return `[Success] Already up to date\n\n**Branch:** ${TARGET_BRANCH}\n**Upstream commit:** \`${shortUpstream}\` is already in your ${TARGET_BRANCH} branch\n**Current HEAD:** \`${shortFork}\``
    }
    
    const tempBranch = `upstream-sync-${Date.now()}`
    
    try {
      await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: `refs/heads/${tempBranch}`,
          sha: upstreamSha,
        }),
      })
      console.log('Temp branch created:', tempBranch)
    } catch (e: any) {
      throw new Error(`Cannot access upstream commit ${shortUpstream} in fork. Please run:\n\`\`\`git remote add upstream https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git\ngit fetch upstream\ngit merge upstream/${UPSTREAM_BRANCH}\ngit push\`\`\``)
    }
    
    try {
      const mergeResp = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/merges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base: TARGET_BRANCH,
          head: tempBranch,
          commit_message: `Merge upstream/${UPSTREAM_BRANCH} into ${TARGET_BRANCH}`,
        }),
      })
      
      try {
        await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${tempBranch}`, {
          method: 'DELETE',
        })
      } catch {}
      
      if (!mergeResp) {
        const updatedFork = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${TARGET_BRANCH}`)
        
        if (updatedFork.object.sha === upstreamSha) {
          console.log('Branch updated to upstream SHA')
          await logToSupabase('sync_logs', {
            triggered_by: userId,
            upstream_sha: upstreamSha,
            merge_sha: upstreamSha,
            status: 'success',
          })
          return `[Success] Sync successful (fast-forward)!\n\n**Upstream SHA:** \`${shortUpstream}\`\n**Branch:** ${UPSTREAM_OWNER}/${UPSTREAM_BRANCH} -> ${GITHUB_OWNER}/${TARGET_BRANCH}`
        }
        
        await logToSupabase('sync_logs', {
          triggered_by: userId,
          upstream_sha: upstreamSha,
          merge_sha: forkSha,
          status: 'already_up_to_date',
        })
        return `[Success] Already up to date\n\n**Upstream commit:** \`${shortUpstream}\` is already in your ${TARGET_BRANCH} branch\n**Current HEAD:** \`${shortFork}\``
      }
      
      console.log('Merge successful')
      const mergeSha = mergeResp.sha
      
      await logToSupabase('sync_logs', {
        triggered_by: userId,
        upstream_sha: upstreamSha,
        merge_sha: mergeSha,
        status: 'success',
      })
      
      return `[Success] Sync successful!\n\n**Upstream SHA:** \`${shortUpstream}\`\n**Merge SHA:** \`${mergeSha.substring(0, 7)}\`\n**Branch:** ${UPSTREAM_OWNER}/${UPSTREAM_BRANCH} -> ${GITHUB_OWNER}/${TARGET_BRANCH}\n**Commits:** ${compare.ahead_by}`
      
    } catch (mergeError: any) {
      try {
        await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${tempBranch}`, {
          method: 'DELETE',
        })
      } catch {}
      throw mergeError
    }
    
  } catch (error: any) {
    console.error('Sync error:', error)
    
    if (error.message.includes('405') || error.message.includes('409') || error.message.includes('conflict')) {
      await logToSupabase('sync_logs', {
        triggered_by: userId,
        upstream_sha: upstreamSha,
        merge_sha: null,
        status: 'conflict',
      })
      
      return `[Warning] Merge conflict\n\n**Upstream SHA:** \`${shortUpstream}\`\n**Your SHA:** \`${shortFork}\`\n\nPlease resolve manually:\n\`\`\`git remote add upstream https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git\ngit fetch upstream\ngit checkout ${TARGET_BRANCH}\ngit merge upstream/${UPSTREAM_BRANCH}\n# Resolve conflicts\ngit push\`\`\``
    }
    
    throw error
  }
}

async function handleTags(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const tags = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/tags?per_page=15`)
    
    if (tags.length === 0) {
      return '[List] No tags found'
    }
    
    const tagList = tags.map((t: any, i: number) => 
      `${i + 1}. **${t.name}** - \`${t.commit.sha.substring(0, 7)}\``
    ).join('\n')
    
    return `[List] Tags (${tags.length})\n\n${tagList}`
  }
  
  if (subcommand === 'create') {
    const tagName = options?.find((o: any) => o.name === 'name')?.value
    const tagMessage = options?.find((o: any) => o.name === 'message')?.value || `Release ${tagName}`
    
    if (!tagName) {
      return '[Error] Tag name is required'
    }
    
    const branchResp = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${TARGET_BRANCH}`)
    const commitSha = branchResp.object.sha
    
    const tagResp = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag: tagName,
        message: tagMessage,
        object: commitSha,
        type: 'commit',
      }),
    })
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/tags/${tagName}`,
        sha: tagResp.sha,
      }),
    })
    
    await logToSupabase('tag_logs', {
      triggered_by: userId,
      tag_name: tagName,
      tag_sha: tagResp.sha,
      commit_sha: commitSha,
      action: 'create',
      status: 'success',
    })
    
    return `[Success] Tag created\n\n**Name:** ${tagName}\n**Commit:** \`${commitSha.substring(0, 7)}\`\n**Message:** ${tagMessage}`
  }
  
  if (subcommand === 'delete') {
    const tagName = options?.find((o: any) => o.name === 'name')?.value
    
    if (!tagName) {
      return '[Error] Tag name is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/tags/${tagName}`, {
      method: 'DELETE',
    })
    
    await logToSupabase('tag_logs', {
      triggered_by: userId,
      tag_name: tagName,
      action: 'delete',
      status: 'success',
    })
    
    return `[Success] Tag deleted: **${tagName}**`
  }
  
  return '[Unknown] Unknown tags command'
}

async function handleBranches(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const branches = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches?per_page=100`)
    
    if (branches.length === 0) {
      return '[Branch] No branches found'
    }
    
    const protections: Record<string, boolean> = {}
    
    await Promise.all(branches.map(async (branch: any) => {
      try {
        await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches/${branch.name}/protection`)
        protections[branch.name] = true
      } catch {
        protections[branch.name] = false
      }
    }))
    
    const branchList = branches.slice(0, 25).map((b: any) => {
      const icon = protections[b.name] ? '[Locked]' : '[Open]'
      return `${icon} **${b.name}** - \`${b.commit.sha.substring(0, 7)}\``
    }).join('\n')
    
    return `[Branch] Branches (${branches.length} total)\n\n${branchList}`
  }
  
  if (subcommand === 'create') {
    const branchName = options?.find((o: any) => o.name === 'name')?.value
    const sha = options?.find((o: any) => o.name === 'sha')?.value
    
    if (!branchName) {
      return '[Error] Branch name is required'
    }
    
    // Get latest commit SHA if not provided
    let commitSha = sha
    if (!commitSha) {
      const branchResp = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${TARGET_BRANCH}`)
      commitSha = branchResp.object.sha
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: commitSha,
      }),
    })
    
    await logToSupabase('branch_logs', {
      triggered_by: userId,
      branch_name: branchName,
      action: 'create',
      status: 'success',
    })
    
    return `[Success] Branch created\n\n**Name:** ${branchName}\n**From commit:** \`${commitSha.substring(0, 7)}\``
  }
  
  if (subcommand === 'delete') {
    const branchName = options?.find((o: any) => o.name === 'name')?.value
    
    if (!branchName) {
      return '[Error] Branch name is required'
    }
    
    if (branchName === TARGET_BRANCH || branchName === 'main' || branchName === 'master') {
      return '[Error] Cannot delete main branch'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${branchName}`, {
      method: 'DELETE',
    })
    
    await logToSupabase('branch_logs', {
      triggered_by: userId,
      branch_name: branchName,
      action: 'delete',
      status: 'success',
    })
    
    return `[Success] Branch deleted: **${branchName}**`
  }
  
  if (subcommand === 'protect') {
    const branchName = options?.find((o: any) => o.name === 'name')?.value
    
    if (!branchName) {
      return '[Error] Branch name is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches/${branchName}/protection`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        required_status_checks: null,
        enforce_admins: true,
        required_pull_request_reviews: {
          dismissal_restrictions: {},
          dismiss_stale_reviews: false,
          require_code_owner_reviews: false,
          required_approving_review_count: 1,
        },
        restrictions: null,
      }),
    })
    
    await logToSupabase('branch_logs', {
      triggered_by: userId,
      branch_name: branchName,
      action: 'protect',
      status: 'success',
    })
    
    return `[Success] Branch protected\n\n**Name:** ${branchName}\n**Requirements:** 1 review required, admin enforcement enabled`
  }
  
  if (subcommand === 'unprotect') {
    const branchName = options?.find((o: any) => o.name === 'name')?.value
    
    if (!branchName) {
      return '[Error] Branch name is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches/${branchName}/protection`, {
      method: 'DELETE',
    })
    
    await logToSupabase('branch_logs', {
      triggered_by: userId,
      branch_name: branchName,
      action: 'unprotect',
      status: 'success',
    })
    
    return `[Success] Branch unprotected: **${branchName}**`
  }
  
  return '[Unknown] Unknown branches command'
}

async function handlePRs(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const state = options?.find((o: any) => o.name === 'state')?.value || 'open'
    const prs = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?state=${state}&per_page=15`)
    
    if (prs.length === 0) {
      return `[List] No ${state} PRs found`
    }
    
    const prList = prs.map((pr: any) => {
      const icon = pr.state === 'open' ? '[Open]' : pr.state === 'closed' ? '[Closed]' : '[Merged]'
      return `${icon} **#${pr.number}** ${pr.title}\n   [User] ${pr.user.login} | ${pr.head.ref} -> ${pr.base.ref}`
    }).join('\n\n')
    
    return `[List] PRs (${state.toUpperCase()} - ${prs.length})\n\n${prList}`
  }
  
  if (subcommand === 'view') {
    const prNumber = options?.find((o: any) => o.name === 'number')?.value
    
    if (!prNumber) {
      return '[Error] PR number is required'
    }
    
    const pr = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`)
    
    const statusIcon = pr.state === 'open' ? '[Open]' : pr.state === 'closed' ? '[Closed]' : '[Merged]'
    const mergeStatus = pr.merged ? '[Success] Merged' : pr.mergeable === false ? '[Error] Conflicted' : pr.mergeable ? '[Success] Mergeable' : '[Pending] Pending'
    
    return `[View] PR #${pr.number} - ${pr.title}\n\n` +
      `**Status:** ${statusIcon} ${pr.state.toUpperCase()} ${pr.merged ? '(Merged)' : ''}\n` +
      `**Merge Status:** ${mergeStatus}\n` +
      `**Author:** ${pr.user.login}\n` +
      `**Branches:** ${pr.head.ref} -> ${pr.base.ref}\n` +
      `**Commits:** ${pr.commits}\n` +
      `**Files:** ${pr.changed_files}\n` +
      `**Additions:** +${pr.additions} | **Deletions:** -${pr.deletions}\n` +
      `**Created:** ${new Date(pr.created_at).toLocaleDateString()}\n` +
      `**URL:** ${pr.html_url}`
  }
  
  if (subcommand === 'merge') {
    const prNumber = options?.find((o: any) => o.name === 'number')?.value
    
    if (!prNumber) {
      return '[Error] PR number is required'
    }
    
    const result = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commit_title: `Merge PR #${prNumber}`,
        merge_method: 'merge',
      }),
    })
    
    await logToSupabase('pr_logs', {
      triggered_by: userId,
      pr_number: prNumber,
      action: 'merge',
      status: 'success',
    })
    
    return `[Success] PR merged\n\n**PR #${prNumber}**\n**Merge SHA:** \`${result.sha.substring(0, 7)}\``
  }
  
  if (subcommand === 'review') {
    const prNumber = options?.find((o: any) => o.name === 'number')?.value
    const comment = options?.find((o: any) => o.name === 'comment')?.value || 'Reviewed'
    
    if (!prNumber) {
      return '[Error] PR number is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: comment,
        event: 'COMMENT',
      }),
    })
    
    await logToSupabase('pr_logs', {
      triggered_by: userId,
      pr_number: prNumber,
      action: 'review',
      status: 'success',
    })
    
    return `[Success] Review added\n\n**PR #${prNumber}**\n**Comment:** ${comment}`
  }
  
  if (subcommand === 'approve') {
    const prNumber = options?.find((o: any) => o.name === 'number')?.value
    
    if (!prNumber) {
      return '[Error] PR number is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: 'Approved',
        event: 'APPROVE',
      }),
    })
    
    await logToSupabase('pr_logs', {
      triggered_by: userId,
      pr_number: prNumber,
      action: 'approve',
      status: 'success',
    })
    
    return `[Success] PR approved\n\n**PR #${prNumber}**`
  }
  
  if (subcommand === 'close') {
    const prNumber = options?.find((o: any) => o.name === 'number')?.value
    
    if (!prNumber) {
      return '[Error] PR number is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'closed',
      }),
    })
    
    await logToSupabase('pr_logs', {
      triggered_by: userId,
      pr_number: prNumber,
      action: 'close',
      status: 'success',
    })
    
    return `[Success] PR closed\n\n**PR #${prNumber}**`
  }
  
  return '[Unknown] Unknown PRs command'
}

// ==================== USER MANAGEMENT ====================

async function handleUsers(subcommand: string, options: any[], userId: string): Promise<string> {
  // Check if user has admin role
  const isAdmin = await hasAdminRole(userId)
  if (!isAdmin) {
    return '[Error] Only admins can manage users'
  }
  
  if (subcommand === 'list') {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    
    const users: User[] = await response.json()
    
    if (users.length === 0) {
      return '[Users] No users found'
    }
    
    const userList = users.map((user: User, i: number) => {
      const roleIcon = user.role === 'owner' ? '[Owner]' : user.role === 'admin' ? '[Admin]' : '[User]'
      return `${i + 1}. ${roleIcon} **${user.username}** (${user.role})\n   ID: ${user.discord_user_id}`
    }).join('\n\n')
    
    return `[Users] Users (${users.length})\n\n${userList}`
  }
  
  if (subcommand === 'add') {
    const targetUserId = options?.find((o: any) => o.name === 'user_id')?.value
    const username = options?.find((o: any) => o.name === 'username')?.value
    const role = options?.find((o: any) => o.name === 'role')?.value || 'user'
    
    if (!targetUserId || !username) {
      return '[Error] User ID and username are required'
    }
    
    // Check if trying to add an owner
    if (role === 'owner' && !await isOwner(userId)) {
      return '[Error] Only owners can add other owners'
    }
    
    await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        discord_user_id: targetUserId,
        username: username,
        role: role,
      }),
    })
    
    await logToSupabase('user_logs', {
      triggered_by: userId,
      target_user_id: targetUserId,
      action: 'add',
      details: `Added ${username} as ${role}`,
      status: 'success',
    })
    
    return `[Success] User added\n\n**Username:** ${username}\n**Role:** ${role}\n**ID:** ${targetUserId}`
  }
  
  if (subcommand === 'remove') {
    const targetUserId = options?.find((o: any) => o.name === 'user_id')?.value
    
    if (!targetUserId) {
      return '[Error] User ID is required'
    }
    
    const targetUserRole = await getUserRole(targetUserId)
    const currentRole = await getUserRole(userId)
    
    // Cannot remove users with higher or equal role
    if (targetUserRole === 'owner') {
      return '[Error] Cannot remove owner'
    }
    if (targetUserRole === 'admin' && currentRole !== 'owner') {
      return '[Error] Only owners can remove admins'
    }
    if (targetUserId === userId) {
      return '[Error] Cannot remove yourself'
    }
    
    await fetch(`${SUPABASE_URL}/rest/v1/users?discord_user_id=eq.${targetUserId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
    
    await logToSupabase('user_logs', {
      triggered_by: userId,
      target_user_id: targetUserId,
      action: 'remove',
      status: 'success',
    })
    
    return `[Success] User removed\n\n**ID:** ${targetUserId}`
  }
  
  if (subcommand === 'promote') {
    const targetUserId = options?.find((o: any) => o.name === 'user_id')?.value
    
    if (!targetUserId) {
      return '[Error] User ID is required'
    }
    
    if (!await isOwner(userId)) {
      return '[Error] Only owners can promote users to admin'
    }
    
    const targetUserRole = await getUserRole(targetUserId)
    if (targetUserRole !== 'user') {
      return '[Error] Can only promote users to admin'
    }
    
    await fetch(`${SUPABASE_URL}/rest/v1/users?discord_user_id=eq.${targetUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        role: 'admin',
      }),
    })
    
    await logToSupabase('user_logs', {
      triggered_by: userId,
      target_user_id: targetUserId,
      action: 'promote',
      details: 'Promoted to admin',
      status: 'success',
    })
    
    return `[Success] User promoted to admin\n\n**ID:** ${targetUserId}`
  }
  
  if (subcommand === 'demote') {
    const targetUserId = options?.find((o: any) => o.name === 'user_id')?.value
    
    if (!targetUserId) {
      return '[Error] User ID is required'
    }
    
    if (!await isOwner(userId)) {
      return '[Error] Only owners can demote admins'
    }
    
    const targetUserRole = await getUserRole(targetUserId)
    if (targetUserRole !== 'admin') {
      return '[Error] Can only demote admins to user'
    }
    
    await fetch(`${SUPABASE_URL}/rest/v1/users?discord_user_id=eq.${targetUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        role: 'user',
      }),
    })
    
    await logToSupabase('user_logs', {
      triggered_by: userId,
      target_user_id: targetUserId,
      action: 'demote',
      details: 'Demoted to user',
      status: 'success',
    })
    
    return `[Success] User demoted to user\n\n**ID:** ${targetUserId}`
  }
  
  return '[Unknown] Unknown users command'
}

// ==================== RELEASE MANAGEMENT ====================

async function handleReleases(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const releases = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=15`)
    
    if (releases.length === 0) {
      return '[Release] No releases found'
    }
    
    const releaseList = releases.map((r: any, i: number) => {
      const icon = r.prerelease ? '[Prerelease]' : r.draft ? '[Draft]' : '[Published]'
      return `${i + 1}. ${icon} **${r.name || r.tag_name}** (${r.tag_name})\n   ${r.author.login} | ${new Date(r.published_at || r.created_at).toLocaleDateString()}`
    }).join('\n\n')
    
    return `[Release] Releases (${releases.length})\n\n${releaseList}`
  }
  
  if (subcommand === 'create') {
    const tag = options?.find((o: any) => o.name === 'tag')?.value
    const name = options?.find((o: any) => o.name === 'name')?.value
    const body = options?.find((o: any) => o.name === 'body')?.value || ''
    
    if (!tag || !name) {
      return '[Error] Tag and name are required'
    }
    
    const release = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: tag,
        name: name,
        body: body,
        draft: false,
        prerelease: false,
      }),
    })
    
    await logToSupabase('release_logs', {
      triggered_by: userId,
      tag_name: tag,
      action: 'create',
      status: 'success',
    })
    
    return `[Success] Release created\n\n**Name:** ${name}\n**Tag:** ${tag}\n**URL:** ${release.html_url}`
  }
  
  if (subcommand === 'delete') {
    const tag = options?.find((o: any) => o.name === 'tag')?.value
    
    if (!tag) {
      return '[Error] Tag is required'
    }
    
    // Find release by tag
    const releases = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${tag}`)
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/${releases.id}`, {
      method: 'DELETE',
    })
    
    await logToSupabase('release_logs', {
      triggered_by: userId,
      tag_name: tag,
      action: 'delete',
      status: 'success',
    })
    
    return `[Success] Release deleted\n\n**Tag:** ${tag}`
  }
  
  if (subcommand === 'view') {
    const tag = options?.find((o: any) => o.name === 'tag')?.value
    
    if (!tag) {
      return '[Error] Tag is required'
    }
    
    const release = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${tag}`)
    
    const icon = release.prerelease ? '[Prerelease]' : release.draft ? '[Draft]' : '[Published]'
    const assets = release.assets?.map((a: any) => `* ${a.name} (${(a.size / 1024).toFixed(1)} KB)`).join('\n') || 'No assets'
    
    return `[Release] ${icon} ${release.name || release.tag_name}\n\n` +
      `**Tag:** ${release.tag_name}\n` +
      `**Author:** ${release.author.login}\n` +
      `**Published:** ${new Date(release.published_at || release.created_at).toLocaleDateString()}\n` +
      `**Downloads:** ${release.assets?.reduce((sum: number, a: any) => sum + a.download_count, 0) || 0}\n\n` +
      `**Assets:**\n${assets}\n\n` +
      `**Notes:**\n${release.body || 'No description'}\n\n` +
      `**URL:** ${release.html_url}`
  }
  
  return '[Unknown] Unknown releases command'
}

// ==================== ISSUE MANAGEMENT ====================

async function handleIssues(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const state = options?.find((o: any) => o.name === 'state')?.value || 'open'
    const issues = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?state=${state}&per_page=15`)
    
    if (issues.length === 0) {
      return `[List] No ${state} issues found`
    }
    
    const issueList = issues.map((issue: any) => {
      const icon = issue.state === 'open' ? '[Open]' : '[Closed]'
      const labels = issue.labels?.map((l: any) => `#${l.name}`).join(' ') || ''
      return `${icon} **#${issue.number}** ${issue.title} ${labels}\n   [User] ${issue.user.login}`
    }).join('\n\n')
    
    return `[List] Issues (${state.toUpperCase()} - ${issues.length})\n\n${issueList}`
  }
  
  if (subcommand === 'create') {
    const title = options?.find((o: any) => o.name === 'title')?.value
    const body = options?.find((o: any) => o.name === 'body')?.value || ''
    
    if (!title) {
      return '[Error] Title is required'
    }
    
    const issue = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        body: body,
      }),
    })
    
    await logToSupabase('issue_logs', {
      triggered_by: userId,
      issue_number: issue.number,
      action: 'create',
      status: 'success',
    })
    
    return `[Success] Issue created\n\n**#${issue.number}** ${title}\n**URL:** ${issue.html_url}`
  }
  
  if (subcommand === 'view') {
    const number = options?.find((o: any) => o.name === 'number')?.value
    
    if (!number) {
      return '[Error] Issue number is required'
    }
    
    const issue = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${number}`)
    
    const statusIcon = issue.state === 'open' ? '[Open]' : '[Closed]'
    const labels = issue.labels?.map((l: any) => `#${l.name}`).join(', ') || 'No labels'
    
    return `[List] Issue #${issue.number}\n\n` +
      `**Status:** ${statusIcon} ${issue.state.toUpperCase()}\n` +
      `**Title:** ${issue.title}\n` +
      `**Author:** ${issue.user.login}\n` +
      `**Labels:** ${labels}\n` +
      `**Comments:** ${issue.comments}\n` +
      `**Created:** ${new Date(issue.created_at).toLocaleDateString()}\n\n` +
      `**Description:**\n${issue.body || 'No description'}\n\n` +
      `**URL:** ${issue.html_url}`
  }
  
  if (subcommand === 'close') {
    const number = options?.find((o: any) => o.name === 'number')?.value
    
    if (!number) {
      return '[Error] Issue number is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'closed',
      }),
    })
    
    await logToSupabase('issue_logs', {
      triggered_by: userId,
      issue_number: number,
      action: 'close',
      status: 'success',
    })
    
    return `[Success] Issue closed\n\n**#${number}**`
  }
  
  if (subcommand === 'comment') {
    const number = options?.find((o: any) => o.name === 'number')?.value
    const comment = options?.find((o: any) => o.name === 'comment')?.value
    
    if (!number || !comment) {
      return '[Error] Issue number and comment are required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${number}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: comment,
      }),
    })
    
    await logToSupabase('issue_logs', {
      triggered_by: userId,
      issue_number: number,
      action: 'comment',
      status: 'success',
    })
    
    return `[Success] Comment added\n\n**Issue #${number}**`
  }
  
  return '[Unknown] Unknown issues command'
}

// ==================== COMMIT HISTORY ====================

async function handleCommits(subcommand: string, options: any[]): Promise<string> {
  if (!subcommand || subcommand === 'list') {
    const branch = options?.find((o: any) => o.name === 'branch')?.value || TARGET_BRANCH
    const commits = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?sha=${branch}&per_page=15`)
    
    if (commits.length === 0) {
      return '[Commit] No commits found'
    }
    
    const commitList = commits.map((c: any, i: number) => {
      const shortSha = c.sha.substring(0, 7)
      const message = c.commit.message.split('\n')[0].substring(0, 60)
      return `${i + 1}. \`${shortSha}\` ${message}\n   [User] ${c.author?.login || c.commit.author.name} | ${new Date(c.commit.author.date).toLocaleDateString()}`
    }).join('\n\n')
    
    return `[Commit] Commits on ${branch} (${commits.length})\n\n${commitList}`
  }
  
  if (subcommand === 'view') {
    const sha = options?.find((o: any) => o.name === 'sha')?.value
    
    if (!sha) {
      return '[Error] Commit SHA is required'
    }
    
    const commit = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${sha}`)
    
    const files = commit.files?.map((f: any) => {
      const icon = f.status === 'added' ? '[Added]' : f.status === 'deleted' ? '[Deleted]' : f.status === 'modified' ? '[Modified]' : '[Renamed]'
      return `${icon} ${f.filename} (${f.status})\n   +${f.additions} -${f.deletions}`
    }).join('\n\n') || 'No files changed'
    
    return `[Commit] Commit ${commit.sha.substring(0, 7)}\n\n` +
      `**Author:** ${commit.author?.login || commit.commit.author.name}\n` +
      `**Date:** ${new Date(commit.commit.author.date).toLocaleString()}\n` +
      `**Message:**\n${commit.commit.message}\n\n` +
      `**Files Changed:** ${commit.files?.length || 0}\n` +
      `**Additions:** +${commit.stats?.additions || 0} | **Deletions:** -${commit.stats?.deletions || 0}\n\n` +
      `**Files:**\n${files}\n\n` +
      `**URL:** ${commit.html_url}`
  }
  
  if (subcommand === 'diff') {
    const sha1 = options?.find((o: any) => o.name === 'sha1')?.value
    const sha2 = options?.find((o: any) => o.name === 'sha2')?.value
    
    if (!sha1 || !sha2) {
      return '[Error] Both commit SHAs are required'
    }
    
    const compare = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/compare/${sha1}...${sha2}`)
    
    const files = compare.files?.map((f: any) => {
      const icon = f.status === 'added' ? '[Added]' : f.status === 'deleted' ? '[Deleted]' : f.status === 'modified' ? '[Modified]' : '[Renamed]'
      return `${icon} ${f.filename}\n   +${f.additions} -${f.deletions}`
    }).join('\n\n') || 'No files changed'
    
    return `[Commit] Diff ${sha1.substring(0, 7)} -> ${sha2.substring(0, 7)}\n\n` +
      `**Commits:** ${compare.ahead_by} ahead, ${compare.behind_by} behind\n` +
      `**Files Changed:** ${compare.files?.length || 0}\n` +
      `**Additions:** +${compare.ahead_by} | **Deletions:** -${compare.behind_by}\n\n` +
      `**Files:**\n${files}`
  }
  
  return '[Unknown] Unknown commits command'
}

// ==================== SCHEDULED TASKS ====================

async function handleSchedule(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/scheduled_tasks?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    
    const tasks = await response.json()
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return '[Schedule] No scheduled tasks'
    }
    
    const taskList = tasks.map((task: any, i: number) => {
      const statusIcon = task.status === 'active' ? '[Active]' : '[Paused]'
      return `${i + 1}. ${statusIcon} **${task.task_type}**\n   ID: ${task.id}\n   Schedule: ${task.schedule}\n   Next run: ${new Date(task.next_run).toLocaleString()}`
    }).join('\n\n')
    
    return `[Schedule] Scheduled Tasks (${tasks.length})\n\n${taskList}`
  }
  
  if (subcommand === 'sync') {
    const schedule = options?.find((o: any) => o.name === 'schedule')?.value || '0 0 * * *'
    
    // Calculate next run time (daily at midnight by default)
    const nextRun = new Date()
    nextRun.setDate(nextRun.getDate() + 1)
    nextRun.setHours(0, 0, 0, 0)
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/scheduled_tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        task_type: 'sync',
        schedule: schedule,
        next_run: nextRun.toISOString(),
        status: 'active',
        created_by: userId,
      }),
    })
    
    const task = await response.json()
    
    await logToSupabase('schedule_logs', {
      triggered_by: userId,
      task_id: task[0]?.id,
      action: 'create',
      details: `Scheduled sync: ${schedule}`,
      status: 'success',
    })
    
    return `[Success] Sync scheduled\n\n**Task ID:** ${task[0]?.id}\n**Schedule:** ${schedule}\n**Next run:** ${nextRun.toLocaleString()}`
  }
  
  if (subcommand === 'remove') {
    const taskId = options?.find((o: any) => o.name === 'id')?.value
    
    if (!taskId) {
      return '[Error] Task ID is required'
    }
    
    await fetch(`${SUPABASE_URL}/rest/v1/scheduled_tasks?id=eq.${taskId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
    
    await logToSupabase('schedule_logs', {
      triggered_by: userId,
      task_id: taskId,
      action: 'remove',
      status: 'success',
    })
    
    return `[Success] Task removed\n\n**ID:** ${taskId}`
  }
  
  return '[Unknown] Unknown schedule command'
}

// ==================== FILE OPERATIONS ====================

async function handleFiles(subcommand: string, options: any[]): Promise<string> {
  if (subcommand === 'list') {
    const branch = options?.find((o: any) => o.name === 'branch')?.value || TARGET_BRANCH
    const path = options?.find((o: any) => o.name === 'path')?.value || ''
    
    const contents = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${branch}`)
    
    if (!Array.isArray(contents)) {
      return `[File] File: ${contents.name}\n**Type:** ${contents.type}\n**Size:** ${contents.size} bytes\n**URL:** ${contents.html_url}`
    }
    
    if (contents.length === 0) {
      return '[File] Empty directory'
    }
    
    const fileList = contents.map((item: any, i: number) => {
      const icon = item.type === 'dir' ? '[DIR]' : '[FILE]'
      return `${i + 1}. ${icon} ${item.name}`
    }).join('\n')
    
    return `[File] Files in ${path || '/'} (${branch})\n\n${fileList}`
  }
  
  if (subcommand === 'view') {
    const branch = options?.find((o: any) => o.name === 'branch')?.value || TARGET_BRANCH
    const path = options?.find((o: any) => o.name === 'path')?.value
    
    if (!path) {
      return '[Error] File path is required'
    }
    
    const file = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${branch}`)
    
    if (file.type === 'dir') {
      return `[Error] ${path} is a directory, use /files list to view its contents`
    }
    
    // Decode base64 content
    const content = atob(file.content)
    const truncatedContent = content.length > 1900 ? content.substring(0, 1900) + '\n... (truncated)' : content
    
    return `[File] ${file.name} (${branch})\n` +
      `**Size:** ${file.size} bytes\n` +
      `**URL:** ${file.html_url}\n\n` +
      `**Content:**\n\`\`\`\n${truncatedContent}\n\`\`\``
  }
  
  return '[Unknown] Unknown files command'
}

// ==================== STATISTICS ====================

async function handleStats(): Promise<string> {
  const [repo, branches, contributors, commits] = await Promise.all([
    githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}`),
    githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches`),
    githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contributors`),
    githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?per_page=1`),
  ])
  
  const openPRs = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?state=open`)
  const openIssues = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?state=open`)
  
  const topContributors = contributors.slice(0, 5).map((c: any, i: number) => 
    `${i + 1}. ${c.login} (${c.contributions} contributions)`
  ).join('\n')
  
  return `[Stats] Repository Statistics\n\n` +
    `**[Repo] Repository:** ${GITHUB_OWNER}/${GITHUB_REPO}\n` +
    `**[Star] Stars:** ${repo.stargazers_count}\n` +
    `**[Fork] Forks:** ${repo.forks_count}\n` +
    `[Watch] **Watchers:** ${repo.watchers_count}\n\n` +
    `**[Branch] Branches:** ${branches.length}\n` +
    `**[PR] Open PRs:** ${openPRs.length}\n` +
    `**[List] Open Issues:** ${openIssues.length}\n` +
    `[Users] **Contributors:** ${contributors.length}\n\n` +
    `**Top Contributors:**\n${topContributors}\n\n` +
    `**Latest Commit:** \`${commits[0]?.sha.substring(0, 7) || 'N/A'}\`\n` +
    `**Language:** ${repo.language || 'N/A'}\n` +
    `**Size:** ${(repo.size / 1024).toFixed(2)} MB\n` +
    `**Created:** ${new Date(repo.created_at).toLocaleDateString()}\n` +
    `**Updated:** ${new Date(repo.updated_at).toLocaleDateString()}`
}

// ==================== LABELS ====================

async function handleLabels(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const labels = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/labels?per_page=100`)
    
    if (labels.length === 0) {
      return '[Label] No labels found'
    }
    
    const labelList = labels.map((l: any, i: number) => 
      `${i + 1}. <${l.color}> **${l.name}**\n    ${l.description || 'No description'}`
    ).join('\n\n')
    
    return `[Label] Labels (${labels.length})\n\n${labelList}`
  }
  
  if (subcommand === 'create') {
    const name = options?.find((o: any) => o.name === 'name')?.value
    const color = options?.find((o: any) => o.name === 'color')?.value
    const description = options?.find((o: any) => o.name === 'description')?.value || ''
    
    if (!name || !color) {
      return '[Error] Name and color are required (color without #, e.g., "ff0000" for red)'
    }
    
    const label = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        color: color.replace('#', ''),
        description: description,
      }),
    })
    
    await logToSupabase('label_logs', {
      triggered_by: userId,
      label_name: name,
      action: 'create',
      status: 'success',
    })
    
    return `[Success] Label created\n\n**Name:** ${name}\n**Color:** #${color}\n**Description:** ${description || 'None'}`
  }
  
  if (subcommand === 'delete') {
    const name = options?.find((o: any) => o.name === 'name')?.value
    
    if (!name) {
      return '[Error] Label name is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/labels/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
    
    await logToSupabase('label_logs', {
      triggered_by: userId,
      label_name: name,
      action: 'delete',
      status: 'success',
    })
    
    return `[Success] Label deleted\n\n**Name:** ${name}`
  }
  
  return '[Unknown] Unknown labels command'
}

// ==================== MULTI-REPO ====================

async function handleRepo(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/repositories?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    
    const repos: Repository[] = await response.json()
    
    if (!Array.isArray(repos) || repos.length === 0) {
      return `[Repo] Repositories (1)\n\n**Current:** ${GITHUB_OWNER}/${GITHUB_REPO}`
    }
    
    const repoList = repos.map((r: any, i: number) => 
      `${i + 1}. [Repo] **${r.alias}**\n    ${r.owner}/${r.name}`
    ).join('\n\n')
    
    return `[Repo] Repositories (${repos.length + 1})\n\n**Current:** ${GITHUB_OWNER}/${GITHUB_REPO}\n\n${repoList}`
  }
  
  if (subcommand === 'add') {
    const owner = options?.find((o: any) => o.name === 'owner')?.value
    const name = options?.find((o: any) => o.name === 'name')?.value
    const alias = options?.find((o: any) => o.name === 'alias')?.value || `${owner}/${name}`
    
    if (!owner || !name) {
      return '[Error] Owner and repository name are required'
    }
    
    // Verify repo exists and is accessible
    try {
      await githubRequest(`/repos/${owner}/${name}`)
    } catch {
      return '[Error] Repository not found or not accessible'
    }
    
    await fetch(`${SUPABASE_URL}/rest/v1/repositories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        alias: alias,
        owner: owner,
        name: name,
        added_by: userId,
      }),
    })
    
    await logToSupabase('repo_logs', {
      triggered_by: userId,
      repo: `${owner}/${name}`,
      action: 'add',
      status: 'success',
    })
    
    return `[Success] Repository added\n\n**Alias:** ${alias}\n**Repository:** ${owner}/${name}\n\nUse /repo switch ${alias} to switch to this repository`
  }
  
  if (subcommand === 'remove') {
    const alias = options?.find((o: any) => o.name === 'alias')?.value
    
    if (!alias) {
      return '[Error] Alias is required'
    }
    
    await fetch(`${SUPABASE_URL}/rest/v1/repositories?alias=eq.${alias}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
    
    await logToSupabase('repo_logs', {
      triggered_by: userId,
      repo: alias,
      action: 'remove',
      status: 'success',
    })
    
    return `[Success] Repository removed\n\n**Alias:** ${alias}`
  }
  
  if (subcommand === 'switch') {
    const alias = options?.find((o: any) => o.name === 'alias')?.value
    
    if (!alias) {
      return '[Error] Alias is required'
    }
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/repositories?alias=eq.${alias}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )
    
    const repos = await response.json()
    
    if (!Array.isArray(repos) || repos.length === 0) {
      return `[Error] Repository with alias "${alias}" not found`
    }
    
    const repo = repos[0]
    
    // Update user's active repository
    await fetch(`${SUPABASE_URL}/rest/v1/users?discord_user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        active_repo: alias,
      }),
    })
    
    await logToSupabase('repo_logs', {
      triggered_by: userId,
      repo: alias,
      action: 'switch',
      status: 'success',
    })
    
    return `[Success] Switched repository\n\n**Alias:** ${alias}\n**Repository:** ${repo.owner}/${repo.name}\n\nNote: Environment variables (GITHUB_OWNER, GITHUB_REPO) need to be updated for this to take effect globally`
  }
  
  return '[Unknown] Unknown repo command'
}

// ==================== WEBHOOKS ====================

async function handleWebhook(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const webhooks = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/hooks`)
    
    if (webhooks.length === 0) {
      return '[Webhook] No webhooks found'
    }
    
    const webhookList = webhooks.map((w: any, i: number) => {
      const statusIcon = w.active ? '[Active]' : '[Paused]'
      const url = w.config?.url || 'No URL'
      const shortUrl = url.length > 40 ? url.substring(0, 37) + '...' : url
      return `${i + 1}. ${statusIcon} **${w.name}** (ID: ${w.id})\n    ${shortUrl}\n    Events: ${w.events?.join(', ') || 'All events'}`
    }).join('\n\n')
    
    return `[Webhook] Webhooks (${webhooks.length})\n\n${webhookList}`
  }
  
  if (subcommand === 'create') {
    const url = options?.find((o: any) => o.name === 'url')?.value
    
    if (!url) {
      return '[Error] URL is required'
    }
    
    const webhook = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push', 'pull_request', 'issues'],
        config: {
          url: url,
          content_type: 'json',
        },
      }),
    })
    
    await logToSupabase('webhook_logs', {
      triggered_by: userId,
      webhook_id: webhook.id,
      action: 'create',
      status: 'success',
    })
    
    return `[Success] Webhook created\n\n**ID:** ${webhook.id}\n**URL:** ${url}\n**Events:** push, pull_request, issues`
  }
  
  if (subcommand === 'delete') {
    const id = options?.find((o: any) => o.name === 'id')?.value
    
    if (!id) {
      return '[Error] Webhook ID is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/hooks/${id}`, {
      method: 'DELETE',
    })
    
    await logToSupabase('webhook_logs', {
      triggered_by: userId,
      webhook_id: id,
      action: 'delete',
      status: 'success',
    })
    
    return `[Success] Webhook deleted\n\n**ID:** ${id}`
  }
  
  return '[Unknown] Unknown webhook command'
}

// ==================== COLLABORATORS ====================

async function handleCollaborators(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const collaborators = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/collaborators?per_page=100`)
    
    if (collaborators.length === 0) {
      return '[Users] No collaborators found'
    }
    
    // Get permissions for each collaborator
    const collaboratorList = await Promise.all(collaborators.map(async (c: any) => {
      const perm = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/collaborators/${c.login}/permission`)
      const roleIcon = perm.permission === 'admin' ? '[Owner]' : perm.permission === 'maintain' ? '[Maintain]' : perm.permission === 'write' ? '[Write]' : '[Read]'
      return `${roleIcon} **${c.login}** (${perm.permission})`
    }))
    
    return `[Users] Collaborators (${collaborators.length})\n\n${collaboratorList.join('\n')}`
  }
  
  if (subcommand === 'add') {
    const username = options?.find((o: any) => o.name === 'username')?.value
    const role = options?.find((o: any) => o.name === 'role')?.value || 'write'
    
    if (!username) {
      return '[Error] Username is required'
    }
    
    const validRoles = ['pull', 'triage', 'write', 'maintain', 'admin']
    if (!validRoles.includes(role)) {
      return `[Error] Invalid role. Must be one of: ${validRoles.join(', ')}`
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/collaborators/${username}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permission: role,
      }),
    })
    
    await logToSupabase('collaborator_logs', {
      triggered_by: userId,
      username: username,
      action: 'add',
      details: `Added as ${role}`,
      status: 'success',
    })
    
    return `[Success] Collaborator added\n\n**Username:** ${username}\n**Role:** ${role}`
  }
  
  if (subcommand === 'remove') {
    const username = options?.find((o: any) => o.name === 'username')?.value
    
    if (!username) {
      return '[Error] Username is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/collaborators/${username}`, {
      method: 'DELETE',
    })
    
    await logToSupabase('collaborator_logs', {
      triggered_by: userId,
      username: username,
      action: 'remove',
      status: 'success',
    })
    
    return `[Success] Collaborator removed\n\n**Username:** ${username}`
  }
  
  return '[Unknown] Unknown collaborators command'
}

// ==================== MILESTONES ====================

async function handleMilestones(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const state = options?.find((o: any) => o.name === 'state')?.value || 'open'
    const milestones = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/milestones?state=${state}&per_page=25`)
    
    if (milestones.length === 0) {
      return `[Milestone] No ${state} milestones found`
    }
    
    const milestoneList = milestones.map((m: any, i: number) => {
      const progress = m.open_issues > 0 
        ? Math.round(((m.closed_issues || 0) / (m.open_issues + (m.closed_issues || 0))) * 100)
        : 100
      const dueDate = m.due_on ? new Date(m.due_on).toLocaleDateString() : 'No due date'
      return `${i + 1}. [Milestone] **${m.title}** #${m.number}\n    [Progress] ${progress}% (${m.closed_issues || 0}/${m.open_issues + (m.closed_issues || 0)} closed)\n    [Date] ${dueDate}`
    }).join('\n\n')
    
    return `[Milestone] Milestones (${state.toUpperCase()} - ${milestones.length})\n\n${milestoneList}`
  }
  
  if (subcommand === 'create') {
    const title = options?.find((o: any) => o.name === 'title')?.value
    const dueDate = options?.find((o: any) => o.name === 'due_date')?.value
    const description = options?.find((o: any) => o.name === 'description')?.value || ''
    
    if (!title) {
      return '[Error] Title is required'
    }
    
    const body: any = {
      title: title,
      description: description,
      state: 'open',
    }
    
    if (dueDate) {
      body.due_on = new Date(dueDate).toISOString()
    }
    
    const milestone = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    
    await logToSupabase('milestone_logs', {
      triggered_by: userId,
      milestone_number: milestone.number,
      action: 'create',
      status: 'success',
    })
    
    return `[Success] Milestone created\n\n**#${milestone.number}** ${title}\n**Due:** ${milestone.due_on ? new Date(milestone.due_on).toLocaleDateString() : 'No due date'}`
  }
  
  if (subcommand === 'close') {
    const number = options?.find((o: any) => o.name === 'number')?.value
    
    if (!number) {
      return '[Error] Milestone number is required'
    }
    
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/milestones/${number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'closed',
      }),
    })
    
    await logToSupabase('milestone_logs', {
      triggered_by: userId,
      milestone_number: number,
      action: 'close',
      status: 'success',
    })
    
    return `[Success] Milestone closed\n\n**#${number}**`
  }
  
  return '[Unknown] Unknown milestones command'
}

// ==================== SEARCH ====================

async function handleSearch(subcommand: string, options: any[]): Promise<string> {
  if (subcommand === 'issues') {
    const query = options?.find((o: any) => o.name === 'query')?.value
    
    if (!query) {
      return '[Error] Search query is required'
    }
    
    const results = await githubRequest(`/search/issues?q=${encodeURIComponent(query + ` repo:${GITHUB_OWNER}/${GITHUB_REPO}`)}&per_page=10`)
    
    if (results.total_count === 0) {
      return `[Search] No issues found for "${query}"`
    }
    
    const resultList = results.items.map((item: any, i: number) => {
      const icon = item.state === 'open' ? '[Open]' : '[Closed]'
      const type = item.pull_request ? 'PR' : 'Issue'
      return `${i + 1}. ${icon} **${type} #${item.number}** ${item.title}\n    ${new Date(item.created_at).toLocaleDateString()}`
    }).join('\n\n')
    
    return `[Search] Search Results: "${query}" (${results.total_count} found)\n\n${resultList}`
  }
  
  if (subcommand === 'code') {
    const query = options?.find((o: any) => o.name === 'query')?.value
    
    if (!query) {
      return '[Error] Search query is required'
    }
    
    const results = await githubRequest(`/search/code?q=${encodeURIComponent(query + ` repo:${GITHUB_OWNER}/${GITHUB_REPO}`)}&per_page=10`)
    
    if (results.total_count === 0) {
      return `[Search] No code found for "${query}"`
    }
    
    const resultList = results.items.map((item: any, i: number) => 
      `${i + 1}. [File] ${item.path}\n    ${item.html_url}`
    ).join('\n\n')
    
    return `[Search] Code Search: "${query}" (${results.total_count} found)\n\n${resultList}`
  }
  
  if (subcommand === 'commits') {
    const query = options?.find((o: any) => o.name === 'query')?.value
    
    if (!query) {
      return '[Error] Search query is required'
    }
    
    const results = await githubRequest(`/search/commits?q=${encodeURIComponent(query + ` repo:${GITHUB_OWNER}/${GITHUB_REPO}`)}&per_page=10`)
    
    if (results.total_count === 0) {
      return `[Search] No commits found for "${query}"`
    }
    
    const resultList = results.items.map((item: any, i: number) => {
      const message = item.commit.message.split('\n')[0].substring(0, 50)
      return `${i + 1}. \`${item.sha.substring(0, 7)}\` ${message}\n    [User] ${item.author?.login || item.commit.author.name} | ${new Date(item.commit.author.date).toLocaleDateString()}`
    }).join('\n\n')
    
    return `[Search] Commit Search: "${query}" (${results.total_count} found)\n\n${resultList}`
  }
  
  return '[Unknown] Unknown search command'
}

// ==================== HELPER FUNCTIONS ====================

async function githubRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `https://api.github.com${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })

  if (response.status === 204) {
    return null
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub API error (${response.status}): ${error}`)
  }

  const text = await response.text()
  if (!text) {
    return null
  }
  
  return JSON.parse(text)
}

async function logToSupabase(table: string, data: Record<string, any>): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(data),
    })
  } catch (error) {
    console.error('Failed to log to Supabase:', error)
  }
}

async function sendFollowUp(token: string, content: string): Promise<void> {
  await fetch(
    `https://discord.com/api/v10/webhooks/${DISCORD_CLIENT_ID}/${token}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${DISCORD_TOKEN}`,
      },
      body: JSON.stringify({ content }),
    }
  )
}

export default {}
