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

    // Verify signature
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

      // Send deferred response
      const response = {
        type: 5,
      }
      
      // Process command in background
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
    let content = ''
    
    if (commandName === 'sync') {
      content = await handleSync(userId)
    } else if (commandName === 'tags') {
      const subcommand = options?.[0]?.name
      content = await handleTags(subcommand, options?.[0]?.options, userId)
    } else if (commandName === 'branches') {
      content = await handleBranches()
    } else if (commandName === 'prs') {
      const subcommand = options?.[0]?.name
      content = await handlePRs(subcommand, options?.[0]?.options)
    }
    
    await sendFollowUp(token, content)
  } catch (error: any) {
    console.error(`Error processing ${commandName}:`, error)
    await sendFollowUp(token, `❌ Error: ${error.message}`)
  }
}

async function handleSync(userId: string): Promise<string> {
  console.log('Starting sync for user:', userId)
  
  // Fetch upstream SHA
  console.log('Fetching upstream SHA...')
  const upstreamResp = await githubRequest(`/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/git/refs/heads/${UPSTREAM_BRANCH}`)
  const upstreamSha = upstreamResp.object.sha
  console.log('Upstream SHA:', upstreamSha.substring(0, 7))
  
  // Fetch fork SHA
  console.log('Fetching fork SHA...')
  const forkResp = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${TARGET_BRANCH}`)
  const forkSha = forkResp.object.sha
  console.log('Fork SHA:', forkSha.substring(0, 7))
  
  const shortUpstream = upstreamSha.substring(0, 7)
  const shortFork = forkSha.substring(0, 7)
  
  // Check if already synced
  if (upstreamSha === forkSha) {
    console.log('Already up to date')
    await logToSupabase('sync_logs', {
      triggered_by: userId,
      upstream_sha: upstreamSha,
      merge_sha: forkSha,
      status: 'already_up_to_date',
    })
    
    return `✅ Already up to date\n\n**Branch:** ${TARGET_BRANCH}\n**Current SHA:** \`${shortFork}\``
  }
  
  console.log('Fork is behind upstream, attempting to sync...')
  
  try {
    // First, try the Compare API to see what's different
    console.log('Checking differences between branches...')
    const compare = await githubRequest(`/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/compare/${forkSha}...${upstreamSha}`)
    
    console.log(`Found ${compare.ahead_by} commits ahead, ${compare.behind_by} commits behind`)
    console.log(`Files changed: ${compare.files?.length || 0}`)
    
    // Check if there are any conflicts
    const conflicts = compare.files?.filter((f: any) => f.status === 'conflict')
    if (conflicts && conflicts.length > 0) {
      console.log('Merge conflicts detected:', conflicts.length)
      await logToSupabase('sync_logs', {
        triggered_by: userId,
        upstream_sha: upstreamSha,
        merge_sha: null,
        status: 'conflict',
      })
      
      return `⚠️ Merge conflict detected\n\n**Upstream SHA:** \`${shortUpstream}\`\n**Your SHA:** \`${shortFork}\`\n**Conflicting files:** ${conflicts.length}\n\nPlease resolve manually:\n\`\`\`git remote add upstream https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git\ngit fetch upstream\ngit checkout ${TARGET_BRANCH}\ngit merge upstream/${UPSTREAM_BRANCH}\n# Resolve conflicts\ngit push\`\`\``
    }
    
    // Try to create/update a temporary branch with upstream commit
    console.log('Creating temporary branch for upstream commit...')
    const tempBranch = `upstream-sync-${Date.now()}`
    
    try {
      // Try to create a new branch pointing to upstream commit
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
      console.log('Could not create temp branch, trying to update existing...')
      // If that fails, the upstream commit might not be accessible
      // This means the fork needs to fetch from upstream
      throw new Error(`Cannot access upstream commit ${shortUpstream} in fork. Please run:\n\`\`\`git remote add upstream https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git\ngit fetch upstream\n\`\`\`\nThen try /sync again.`)
    }
    
    // Try to merge the temp branch
    console.log('Merging temp branch into target...')
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
      
      // Clean up temp branch
      try {
        await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${tempBranch}`, {
          method: 'DELETE',
        })
      } catch {}
      
      if (!mergeResp) {
        // Check if branch was updated anyway
        const updatedFork = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${TARGET_BRANCH}`)
        if (updatedFork.object.sha === upstreamSha) {
          console.log('Branch was fast-forwarded to upstream')
          await logToSupabase('sync_logs', {
            triggered_by: userId,
            upstream_sha: upstreamSha,
            merge_sha: upstreamSha,
            status: 'success',
          })
          return `✅ Sync successful (fast-forward)!\n\n**Upstream SHA:** \`${shortUpstream}\`\n**Branch:** ${UPSTREAM_OWNER}/${UPSTREAM_BRANCH} → ${GITHUB_OWNER}/${TARGET_BRANCH}\n**Commits:** ${compare.ahead_by}`
        }
        throw new Error('Merge failed and branch was not updated')
      }
      
      console.log('Merge successful')
      const mergeSha = mergeResp.sha
      
      await logToSupabase('sync_logs', {
        triggered_by: userId,
        upstream_sha: upstreamSha,
        merge_sha: mergeSha,
        status: 'success',
      })
      
      return `✅ Sync successful!\n\n**Upstream SHA:** \`${shortUpstream}\`\n**Merge SHA:** \`${mergeSha.substring(0, 7)}\`\n**Branch:** ${UPSTREAM_OWNER}/${UPSTREAM_BRANCH} → ${GITHUB_OWNER}/${TARGET_BRANCH}\n**Commits:** ${compare.ahead_by}`
      
    } catch (mergeError: any) {
      // Clean up temp branch on error
      try {
        await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${tempBranch}`, {
          method: 'DELETE',
        })
      } catch {}
      throw mergeError
    }
    
  } catch (error: any) {
    console.error('Sync error:', error)
    
    // Check if it's a conflict error
    if (error.message.includes('405') || error.message.includes('409') || error.message.includes('conflict')) {
      await logToSupabase('sync_logs', {
        triggered_by: userId,
        upstream_sha: upstreamSha,
        merge_sha: null,
        status: 'conflict',
      })
      
      return `⚠️ Merge conflict\n\n**Upstream SHA:** \`${shortUpstream}\`\n**Your SHA:** \`${shortFork}\`\n\nPlease resolve manually:\n\`\`\`git remote add upstream https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}.git\ngit fetch upstream\ngit checkout ${TARGET_BRANCH}\ngit merge upstream/${UPSTREAM_BRANCH}\n# Resolve conflicts\ngit push\`\`\``
    }
    
    throw error
  }
}

async function handleTags(subcommand: string, options: any[], userId: string): Promise<string> {
  if (subcommand === 'list') {
    const tags = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/tags?per_page=15`)
    
    if (tags.length === 0) {
      return '📋 No tags found'
    }
    
    const tagList = tags.map((t: any, i: number) => 
      `${i + 1}. **${t.name}** - \`${t.commit.sha.substring(0, 7)}\``
    ).join('\n')
    
    return `📋 Tags (${tags.length})\n\n${tagList}`
  }
  
  if (subcommand === 'create') {
    const tagName = options?.find((o: any) => o.name === 'name')?.value
    const tagMessage = options?.find((o: any) => o.name === 'message')?.value || `Release ${tagName}`
    
    if (!tagName) {
      return '❌ Tag name is required'
    }
    
    // Get latest commit SHA
    const branchResp = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${TARGET_BRANCH}`)
    const commitSha = branchResp.object.sha
    
    // Create tag object
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
    
    // Create ref
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
    
    return `✅ Tag created\n\n**Name:** ${tagName}\n**Commit:** \`${commitSha.substring(0, 7)}\`\n**Message:** ${tagMessage}`
  }
  
  if (subcommand === 'delete') {
    const tagName = options?.find((o: any) => o.name === 'name')?.value
    
    if (!tagName) {
      return '❌ Tag name is required'
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
    
    return `✅ Tag deleted: **${tagName}**`
  }
  
  return '❓ Unknown tags command'
}

async function handleBranches(): Promise<string> {
  const branches = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches?per_page=100`)
  
  if (branches.length === 0) {
    return '🌿 No branches found'
  }
  
  // Check protections
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
    const icon = protections[b.name] ? '🔒' : '🔓'
    return `${icon} **${b.name}** - \`${b.commit.sha.substring(0, 7)}\``
  }).join('\n')
  
  return `🌿 Branches (${branches.length} total)\n\n${branchList}`
}

async function handlePRs(subcommand: string, options: any[]): Promise<string> {
  if (subcommand === 'list') {
    const state = options?.find((o: any) => o.name === 'state')?.value || 'open'
    const prs = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?state=${state}&per_page=15`)
    
    if (prs.length === 0) {
      return `📋 No ${state} PRs found`
    }
    
    const prList = prs.map((pr: any) => {
      const icon = pr.state === 'open' ? '🟢' : pr.state === 'closed' ? '🔴' : '🟣'
      return `${icon} **#${pr.number}** ${pr.title}\n   👤 ${pr.user.login} | ${pr.head.ref} → ${pr.base.ref}`
    }).join('\n\n')
    
    return `📋 PRs (${state.toUpperCase()} - ${prs.length})\n\n${prList}`
  }
  
  if (subcommand === 'view') {
    const prNumber = options?.find((o: any) => o.name === 'number')?.value
    
    if (!prNumber) {
      return '❌ PR number is required'
    }
    
    const pr = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`)
    
    const statusIcon = pr.state === 'open' ? '🟢' : pr.state === 'closed' ? '🔴' : '🟣'
    const mergeStatus = pr.merged ? '✅ Merged' : pr.mergeable === false ? '❌ Conflicted' : pr.mergeable ? '✅ Mergeable' : '⏳ Pending'
    
    return `🔍 PR #${pr.number} - ${pr.title}\n\n` +
      `**Status:** ${statusIcon} ${pr.state.toUpperCase()} ${pr.merged ? '(Merged)' : ''}\n` +
      `**Merge Status:** ${mergeStatus}\n` +
      `**Author:** ${pr.user.login}\n` +
      `**Branches:** ${pr.head.ref} → ${pr.base.ref}\n` +
      `**Commits:** ${pr.commits}\n` +
      `**Files:** ${pr.changed_files}\n` +
      `**Additions:** +${pr.additions} | **Deletions:** -${pr.deletions}\n` +
      `**Created:** ${new Date(pr.created_at).toLocaleDateString()}\n` +
      `**URL:** ${pr.html_url}`
  }
  
  return '❓ Unknown PRs command'
}

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

  // Handle 204 No Content responses
  if (response.status === 204) {
    return null
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub API error (${response.status}): ${error}`)
  }

  // Handle empty responses
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
