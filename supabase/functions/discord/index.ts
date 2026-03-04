import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

  try {
    const body = await req.text()
    const signature = req.headers.get('X-Signature-Ed25519')
    const timestamp = req.headers.get('X-Signature-Timestamp')
    const publicKey = Deno.env.get('DISCORD_PUBLIC_KEY') || ''

    // Log for debugging
    console.log('=== Discord Request ===')
    console.log('Has signature:', !!signature)
    console.log('Has timestamp:', !!timestamp)
    console.log('Has public key:', !!publicKey)
    console.log('Body length:', body.length)

    if (!signature || !timestamp || !publicKey) {
      console.log('Missing required headers')
      return new Response('Missing required headers', { status: 401 })
    }

    // Verify signature
    const message = `${timestamp}${body}`
    const messageBytes = new TextEncoder().encode(message)

    // Convert hex signature to Uint8Array
    const signatureBytes = new Uint8Array(signature.length / 2)
    for (let i = 0; i < signature.length; i += 2) {
      signatureBytes[i / 2] = parseInt(signature.substring(i, i + 2), 16)
    }

    // Convert hex public key to Uint8Array (Discord provides hex, not base64!)
    const publicKeyBytes = new Uint8Array(publicKey.length / 2)
    for (let i = 0; i < publicKey.length; i += 2) {
      publicKeyBytes[i / 2] = parseInt(publicKey.substring(i, i + 2), 16)
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

    console.log('Signature valid:', isValid)

    if (!isValid) {
      console.log('Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }

    const interaction = JSON.parse(body)
    console.log('Interaction type:', interaction.type, 'Interaction:', JSON.stringify(interaction).substring(0, 200))

    // Handle PING (type 1) - Respond immediately
    if (interaction.type === 1) {
      console.log('Responding with PONG')
      const response = {
        type: 1,
      }
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // For all other interactions, we'll route to the appropriate function
    // For now, just acknowledge
    console.log('Acknowledging interaction')
    const response = {
      type: 5, // Deferred response
      data: {},
    }
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in discord function:', error)
    return new Response(`Error: ${error.message}`, { status: 500 })
  }
})

export default {}
