import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  verifyDiscordRequest,
  githubRequest,
  discordResponse,
  followUp,
  getConfig,
  createEmbed,
  formatShortSha,
  formatDate,
  formatNumber,
  InteractionType,
  InteractionResponseType,
} from '../_shared/utils.ts'

serve(async (req: Request) => {
  // Handle CORS preflight
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

  const body = await req.text()
  
  // Verify Discord request signature
  const isValid = await verifyDiscordRequest(req, body)
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 })
  }

  const interaction = JSON.parse(body)

  // Handle PING
  if (interaction.type === InteractionType.PING) {
    return discordResponse(InteractionResponseType.PONG)
  }

  // Handle APPLICATION_COMMAND for /prs
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const subcommand = interaction.data.options?.[0]?.name
    const interactionToken = interaction.token
    
    if (interaction.data.name === 'prs') {
      // Send deferred response
      const deferred = discordResponse(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE)
      
      // Process in background
      globalThis.Deno?.serve(async () => {
        try {
          const { GITHUB_OWNER, GITHUB_REPO } = getConfig()
          
          if (subcommand === 'list') {
            // List PRs
            const state = interaction.data.options[0].options?.find((opt: any) => opt.name === 'state')?.value || 'open'
            
            const prs = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?state=${state}&per_page=15`)
            
            if (prs.length === 0) {
              const embed = createEmbed(
                '📋 Pull Requests',
                `No ${state} pull requests found.`,
                0x5865F2
              )
              
              await followUp(interactionToken, '', [embed])
              return
            }
            
            const prList = prs.map((pr: any, index: number) => {
              const statusIcon = pr.state === 'open' ? '🟢' : pr.state === 'closed' ? '🔴' : '🟣'
              return `${statusIcon} **#${pr.number}** ${pr.title}\n   👤 ${pr.user.login} | ${pr.head.ref} → ${pr.base.ref}`
            }).join('\n\n')
            
            const embed = createEmbed(
              `📋 Pull Requests (${state.toUpperCase()} - ${prs.length})`,
              prList,
              0x5865F2
            )
            
            await followUp(interactionToken, '', [embed])
            
          } else if (subcommand === 'view') {
            // View PR details
            const prNumber = interaction.data.options[0].options?.find((opt: any) => opt.name === 'number')?.value
            
            // Fetch PR details
            const pr = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`)
            
            // Fetch PR reviews
            const reviews = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/reviews`)
            
            // Fetch PR files
            const files = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/files`)
            
            const statusIcon = pr.state === 'open' ? '🟢' : pr.state === 'closed' ? '🔴' : '🟣'
            const mergeStatusIcon = pr.merged ? '✅ Merged' : pr.mergeable === false ? '❌ Conflicted' : pr.mergeable ? '✅ Mergeable' : '⏳ Pending'
            
            const labels = pr.labels.map((label: any) => label.name).join(', ') || 'None'
            const reviewers = [...new Set(reviews.map((review: any) => review.user.login))].join(', ') || 'None'
            
            const fields = [
              {
                name: 'Status',
                value: `${statusIcon} ${pr.state.toUpperCase()} ${pr.merged ? '(Merged)' : ''}`,
                inline: true,
              },
              {
                name: 'Merge Status',
                value: mergeStatusIcon,
                inline: true,
              },
              {
                name: 'Author',
                value: pr.user.login,
                inline: true,
              },
              {
                name: 'Branches',
                value: `${pr.head.ref} → ${pr.base.ref}`,
                inline: true,
              },
              {
                name: 'Commits',
                value: formatNumber(pr.commits),
                inline: true,
              },
              {
                name: 'Changed Files',
                value: formatNumber(pr.changed_files),
                inline: true,
              },
              {
                name: 'Additions',
                value: `+${formatNumber(pr.additions)}`,
                inline: true,
              },
              {
                name: 'Deletions',
                value: `-${formatNumber(pr.deletions)}`,
                inline: true,
              },
              {
                name: 'Labels',
                value: labels.length > 50 ? labels.substring(0, 47) + '...' : labels,
                inline: false,
              },
              {
                name: 'Reviewers',
                value: reviewers.length > 50 ? reviewers.substring(0, 47) + '...' : reviewers,
                inline: false,
              },
              {
                name: 'Created',
                value: formatDate(pr.created_at),
                inline: true,
              },
              {
                name: 'Updated',
                value: formatDate(pr.updated_at),
                inline: true,
              },
            ]
            
            // Add file changes (first 5 files)
            if (files.length > 0) {
              const fileChanges = files.slice(0, 5).map((file: any) => {
                const statusIcon = file.status === 'added' ? '➕' : file.status === 'deleted' ? '➖' : '📝'
                return `${statusIcon} \`${file.filename}\` (+${file.additions}/-${file.deletions})`
              }).join('\n')
              
              fields.push({
                name: `Changed Files (showing ${Math.min(files.length, 5)} of ${files.length})`,
                value: fileChanges,
                inline: false,
              })
            }
            
            const embed = createEmbed(
              `🔍 PR #${pr.number} - ${pr.title}`,
              pr.body ? pr.body.substring(0, 200) + (pr.body.length > 200 ? '...' : '') : 'No description provided.',
              0x5865F2,
              fields
            )
            
            embed.url = pr.html_url
            
            await followUp(interactionToken, '', [embed])
          }
          
        } catch (error: any) {
          console.error('PRs error:', error)
          
          const embed = createEmbed(
            '❌ Failed to Fetch Pull Request',
            `An error occurred: ${error.message}`,
            0xED4245
          )
          
          await followUp(interactionToken, '', [embed])
        }
      })
      
      return deferred
    }
  }
  
  return new Response('Unknown interaction', { status: 400 })
})

export default {}
