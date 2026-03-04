import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  verifyDiscordRequest,
  githubRequest,
  discordResponse,
  followUp,
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

  // Handle APPLICATION_COMMAND for /branches
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    if (interaction.data.name === 'branches') {
      // Send deferred response
      const deferred = discordResponse(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE)
      
      // Process in background
      const interactionToken = interaction.token
      
      globalThis.Deno?.serve(async () => {
        try {
          const { GITHUB_OWNER, GITHUB_REPO } = getConfig()
          
          // Fetch all branches
          const branches = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches?per_page=100`)
          
          // Fetch branch protections
          const protections: Record<string, boolean> = {}
          
          // Check protection for each branch (in parallel)
          await Promise.all(branches.map(async (branch: any) => {
            try {
              const protection = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches/${branch.name}/protection`)
              protections[branch.name] = true
            } catch (e: any) {
              // 404 means no protection
              protections[branch.name] = false
            }
          }))
          
          if (branches.length === 0) {
            const embed = createEmbed(
              '🌿 Branches',
              'No branches found in this repository.',
              0x5865F2
            )
            
            await followUp(interactionToken, '', [embed])
            return
          }
          
          // Create fields for branches (max 25 fields per embed, Discord limit)
          const fields = branches.slice(0, 25).map((branch: any) => {
            const isProtected = protections[branch.name]
            const lockEmoji = isProtected ? '🔒' : '🔓'
            
            return {
              name: `${lockEmoji} ${branch.name}`,
              value: `\`${formatShortSha(branch.commit.sha)}\``,
              inline: true,
            }
          })
          
          const embed = createEmbed(
            `🌿 Branches (${branches.length} total)`,
            branches.length > 25 
              ? `Showing 25 of ${branches.length} branches. Protected branches are marked with 🔒`
              : 'Protected branches are marked with 🔒',
            0x5865F2,
            fields
          )
          
          await followUp(interactionToken, '', [embed])
          
        } catch (error: any) {
          console.error('Branches error:', error)
          
          const embed = createEmbed(
            '❌ Failed to Fetch Branches',
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
