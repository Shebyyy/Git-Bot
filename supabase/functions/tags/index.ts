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

  // Handle APPLICATION_COMMAND for /tags
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const subcommand = interaction.data.options?.[0]?.name
    const userId = interaction.user?.id || interaction.member?.user?.id
    const interactionToken = interaction.token
    
    if (interaction.data.name === 'tags') {
      // Send deferred response for all commands
      const deferred = deferredResponse()
      
      // Process in background
      globalThis.Deno?.serve(async () => {
        try {
          const { GITHUB_OWNER, GITHUB_REPO, TARGET_BRANCH } = getConfig()
          
          if (subcommand === 'list') {
            // List tags
            const tags = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/tags?per_page=15`)
            
            if (tags.length === 0) {
              const embed = createEmbed(
                '📋 Tags',
                'No tags found in this repository.',
                0x5865F2
              )
              
              await followUp(interactionToken, '', [embed])
              return
            }
            
            const tagsList = tags.map((tag: any, index: number) => 
              `${index + 1}. **${tag.name}** - \`${formatShortSha(tag.commit.sha)}\``
            ).join('\n')
            
            const embed = createEmbed(
              `📋 Tags (Showing ${tags.length})`,
              tagsList,
              0x5865F2
            )
            
            await followUp(interactionToken, '', [embed])
            
          } else if (subcommand === 'create') {
            // Create tag
            const tagName = interaction.data.options[0].options?.find((opt: any) => opt.name === 'name')?.value
            const tagMessage = interaction.data.options[0].options?.find((opt: any) => opt.name === 'message')?.value || `Release ${tagName}`
            
            // Get latest commit SHA from target branch
            const branchData = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${TARGET_BRANCH}`)
            const commitSha = branchData.object.sha
            
            // Create annotated tag object
            const tagObject = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/tags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tag: tagName,
                message: tagMessage,
                object: commitSha,
                type: 'commit',
              }),
            })
            
            // Create ref for the tag
            await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ref: `refs/tags/${tagName}`,
                sha: tagObject.sha,
              }),
            })
            
            const embed = createEmbed(
              '✅ Tag Created',
              `Successfully created tag **${tagName}**`,
              0x57F287,
              [
                {
                  name: 'Tag Name',
                  value: tagName,
                  inline: true,
                },
                {
                  name: 'Commit SHA',
                  value: `\`${formatShortSha(commitSha)}\``,
                  inline: true,
                },
                {
                  name: 'Message',
                  value: tagMessage,
                  inline: false,
                },
                {
                  name: 'Tag SHA',
                  value: `\`${formatShortSha(tagObject.sha)}\``,
                  inline: true,
                },
              ]
            )
            
            await followUp(interactionToken, '', [embed])
            
            // Log to tag_logs
            await logToSupabase('tag_logs', {
              triggered_by: userId,
              tag_name: tagName,
              tag_sha: tagObject.sha,
              commit_sha: commitSha,
              action: 'create',
              status: 'success',
            })
            
          } else if (subcommand === 'delete') {
            // Delete tag
            const tagName = interaction.data.options[0].options?.find((opt: any) => opt.name === 'name')?.value
            
            // Delete the tag ref
            await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/tags/${tagName}`, {
              method: 'DELETE',
            })
            
            const embed = createEmbed(
              '✅ Tag Deleted',
              `Successfully deleted tag **${tagName}**`,
              0x57F287,
              [
                {
                  name: 'Tag Name',
                  value: tagName,
                  inline: true,
                },
              ]
            )
            
            await followUp(interactionToken, '', [embed])
            
            // Log to tag_logs
            await logToSupabase('tag_logs', {
              triggered_by: userId,
              tag_name: tagName,
              tag_sha: null,
              commit_sha: null,
              action: 'delete',
              status: 'success',
            })
          }
          
        } catch (error: any) {
          console.error('Tags error:', error)
          
          const embed = createEmbed(
            '❌ Tag Operation Failed',
            `An error occurred: ${error.message}`,
            0xED4245
          )
          
          await followUp(interactionToken, '', [embed])
          
          // Log the failure
          if (subcommand === 'create' || subcommand === 'delete') {
            const tagName = interaction.data.options[0].options?.find((opt: any) => opt.name === 'name')?.value
            await logToSupabase('tag_logs', {
              triggered_by: userId,
              tag_name: tagName || null,
              tag_sha: null,
              commit_sha: null,
              action: subcommand,
              status: 'error',
              error_message: error.message,
            })
          }
        }
      })
      
      return deferred
    }
  }
  
  return new Response('Unknown interaction', { status: 400 })
})

export default {}
