import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  verifyDiscordRequest,
  githubRequest,
  discordResponse,
  deferredResponse,
  followUp,
  logToSupabase,
  getConfig,
  createEmbed,
  formatShortSha,
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

  // Handle APPLICATION_COMMAND for /sync
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    if (interaction.data.name === 'sync') {
      // Send deferred response
      const deferred = deferredResponse()
      
      // Process sync in background
      const userId = interaction.user?.id || interaction.member?.user?.id
      const interactionToken = interaction.token
      
      // Use EdgeRuntime.waitUntil for background processing
      globalThis.Deno?.serve(async () => {
        try {
          const { GITHUB_OWNER, GITHUB_REPO, UPSTREAM_OWNER, UPSTREAM_REPO, UPSTREAM_BRANCH, TARGET_BRANCH } = getConfig()
          
          // Fetch upstream main branch SHA
          const upstreamBranch = await githubRequest(`/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/git/refs/heads/${UPSTREAM_BRANCH}`)
          const upstreamSha = upstreamBranch.object.sha
          
          // Fetch fork's target branch SHA
          const forkBranch = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${TARGET_BRANCH}`)
          const forkSha = forkBranch.object.sha
          
          // Compare SHAs
          if (upstreamSha === forkSha) {
            const embed = createEmbed(
              '✅ Already Up to Date',
              'Your fork is already synchronized with the upstream repository.',
              0x57F287,
              [
                {
                  name: 'Branch',
                  value: `${TARGET_BRANCH} → ${UPSTREAM_BRANCH}`,
                  inline: true,
                },
                {
                  name: 'Current SHA',
                  value: `\`${formatShortSha(forkSha)}\``,
                  inline: true,
                },
              ]
            )
            
            await followUp(interactionToken, '', [embed])
            
            // Log the sync attempt
            await logToSupabase('sync_logs', {
              triggered_by: userId,
              upstream_sha: upstreamSha,
              merge_sha: forkSha,
              status: 'already_up_to_date',
            })
            
            return
          }
          
          // Perform merge using GitHub Merge API
          try {
            const mergeResult = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/merges`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                base: TARGET_BRANCH,
                head: `${UPSTREAM_OWNER}:${UPSTREAM_BRANCH}`,
                commit_message: `Merge upstream/${UPSTREAM_BRANCH} into ${TARGET_BRANCH}`,
              }),
            })
            
            const mergeSha = mergeResult.sha
            
            const embed = createEmbed(
              '✅ Sync Successful',
              'Successfully merged upstream changes into your fork.',
              0x57F287,
              [
                {
                  name: 'Upstream SHA',
                  value: `\`${formatShortSha(upstreamSha)}\``,
                  inline: true,
                },
                {
                  name: 'Merge SHA',
                  value: `\`${formatShortSha(mergeSha)}\``,
                  inline: true,
                },
                {
                  name: 'Branch',
                  value: `${UPSTREAM_OWNER}/${UPSTREAM_BRANCH} → ${GITHUB_OWNER}/${TARGET_BRANCH}`,
                  inline: false,
                },
                {
                  name: 'Commits Merged',
                  value: `${mergeResult.parents.length - 1} commit(s)`,
                  inline: true,
                },
              ]
            )
            
            await followUp(interactionToken, '', [embed])
            
            // Log the successful sync
            await logToSupabase('sync_logs', {
              triggered_by: userId,
              upstream_sha: upstreamSha,
              merge_sha: mergeSha,
              status: 'success',
            })
            
          } catch (mergeError: any) {
            // Handle merge conflicts
            if (mergeError.message.includes('405') || mergeError.message.includes('409')) {
              const embed = createEmbed(
                '⚠️ Merge Conflict',
                'Unable to merge automatically due to conflicts. Please resolve manually.',
                0xED4245,
                [
                  {
                    name: 'Upstream SHA',
                    value: `\`${formatShortSha(upstreamSha)}\``,
                    inline: true,
                  },
                  {
                    name: 'Your SHA',
                    value: `\`${formatShortSha(forkSha)}\``,
                    inline: true,
                  },
                  {
                    name: 'Instructions',
                    value: `1. \`git fetch upstream\`\n2. \`git checkout ${TARGET_BRANCH}\`\n3. \`git merge upstream/${UPSTREAM_BRANCH}\`\n4. Resolve conflicts\n5. \`git push\``,
                    inline: false,
                  },
                ]
              )
              
              await followUp(interactionToken, '', [embed])
              
              // Log the conflict
              await logToSupabase('sync_logs', {
                triggered_by: userId,
                upstream_sha: upstreamSha,
                merge_sha: null,
                status: 'conflict',
              })
            } else {
              throw mergeError
            }
          }
          
        } catch (error: any) {
          console.error('Sync error:', error)
          
          const embed = createEmbed(
            '❌ Sync Failed',
            `An error occurred while syncing: ${error.message}`,
            0xED4245
          )
          
          await followUp(interactionToken, '', [embed])
          
          // Log the failure
          await logToSupabase('sync_logs', {
            triggered_by: userId,
            upstream_sha: null,
            merge_sha: null,
            status: 'error',
            error_message: error.message,
          })
        }
      })
      
      return deferred
    }
  }
  
  return new Response('Unknown interaction', { status: 400 })
})

export default {}
