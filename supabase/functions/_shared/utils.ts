import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Environment variables
const DISCORD_PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY') || ''
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || ''
const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER') || 'Shebyyy'
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') || 'AnymeX'
const UPSTREAM_OWNER = Deno.env.get('UPSTREAM_OWNER') || 'RyanYuuki'
const UPSTREAM_REPO = Deno.env.get('UPSTREAM_REPO') || 'AnymeX'
const UPSTREAM_BRANCH = Deno.env.get('UPSTREAM_BRANCH') || 'main'
const TARGET_BRANCH = Deno.env.get('TARGET_BRANCH') || 'beta'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// Discord interaction types
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
}

// Discord response types
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
}

/**
 * Verify Discord request using Ed25519 signature
 */
export async function verifyDiscordRequest(
  request: Request,
  body: string
): Promise<boolean> {
  const signature = request.headers.get('X-Signature-Ed25519')
  const timestamp = request.headers.get('X-Signature-Timestamp')

  if (!signature || !timestamp) {
    return false
  }

  const message = `${timestamp}${body}`
  
  try {
    const publicKeyBytes = base64ToUint8Array(DISCORD_PUBLIC_KEY)
    const signatureBytes = hexToUint8Array(signature)
    const messageBytes = new TextEncoder().encode(message)

    const isValid = await crypto.subtle.verify(
      'Ed25519',
      publicKeyBytes,
      signatureBytes,
      messageBytes
    )

    return isValid
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}

/**
 * Helper: Convert base64 to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Helper: Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

/**
 * Make a request to GitHub API
 */
export async function githubRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
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

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub API error (${response.status}): ${error}`)
  }

  return response.json()
}

/**
 * Create a Discord response
 */
export function discordResponse(
  type: number,
  data: any = {}
): Response {
  return new Response(JSON.stringify({ type, data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Create a deferred response for long operations
 */
export function deferredResponse(): Response {
  return discordResponse(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE)
}

/**
 * Send a follow-up message to Discord interaction
 */
export async function followUp(
  interactionToken: string,
  content: string,
  embeds: any[] = []
): Promise<Response> {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${process.env.DISCORD_CLIENT_ID}/${interactionToken}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
      },
      body: JSON.stringify({
        content,
        embeds,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Discord follow-up error (${response.status}): ${error}`)
  }

  return response
}

/**
 * Log to Supabase database
 */
export async function logToSupabase(
  table: string,
  data: Record<string, any>
): Promise<void> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`Supabase logging error (${response.status}):`, error)
    }
  } catch (error) {
    console.error('Failed to log to Supabase:', error)
  }
}

/**
 * Get environment configuration
 */
export function getConfig() {
  return {
    GITHUB_OWNER,
    GITHUB_REPO,
    UPSTREAM_OWNER,
    UPSTREAM_REPO,
    UPSTREAM_BRANCH,
    TARGET_BRANCH,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  }
}

/**
 * Create an embed for Discord messages
 */
export function createEmbed(
  title: string,
  description: string,
  color: number = 0x5865F2,
  fields?: { name: string; value: string; inline?: boolean }[]
): any {
  const embed: any = {
    title,
    description,
    color,
  }

  if (fields && fields.length > 0) {
    embed.fields = fields
  }

  return embed
}

/**
 * Format short SHA
 */
export function formatShortSha(sha: string): string {
  return sha.substring(0, 7)
}

/**
 * Format date
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}
