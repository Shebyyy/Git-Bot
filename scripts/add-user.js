import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function addUser(userId, username = null) {
  if (!userId) {
    console.error('❌ Error: User ID is required')
    console.log('\nUsage: node scripts/add-user.js <user-id> [username]')
    console.log('Example: node scripts/add-user.js 123456789012345678 MyUsername')
    process.exit(1)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
    process.exit(1)
  }

  try {
    console.log(`\nAdding user ${username || userId} to allowed users list...`)
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/allowed_users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        discord_user_id: userId.toString(),
        username: username || null,
        added_by: 'script',
      }),
    })

    if (response.ok) {
      console.log(`✅ User ${username || userId} has been added to the allowed users list!`)
      console.log(`\nUser ID: ${userId}`)
      console.log(`Username: ${username || 'Not set'}`)
    } else {
      const error = await response.json()
      if (error.code === '23505') {
        console.log(`ℹ️  User ${username || userId} is already in the allowed users list.`)
      } else {
        console.error('❌ Error adding user:', error.message)
        process.exit(1)
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

async function listUsers() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
    process.exit(1)
  }

  try {
    console.log('\n📋 Allowed Users:\n')
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/allowed_users?select=discord_user_id,username,added_at&order=added_at.desc`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })

    const users = await response.json()
    
    if (users.length === 0) {
      console.log('No users found.')
      return
    }

    users.forEach((user, index) => {
      console.log(`${index + 1}. User ID: ${user.discord_user_id}`)
      if (user.username) console.log(`   Username: ${user.username}`)
      console.log(`   Added: ${new Date(user.added_at).toLocaleString()}`)
      console.log()
    })
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

async function removeUser(userId) {
  if (!userId) {
    console.error('❌ Error: User ID is required')
    console.log('\nUsage: node scripts/add-user.js remove <user-id>')
    process.exit(1)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
    process.exit(1)
  }

  try {
    console.log(`\nRemoving user ${userId} from allowed users list...`)
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/allowed_users?discord_user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal',
        },
      }
    )

    if (response.ok) {
      console.log(`✅ User ${userId} has been removed from the allowed users list!`)
    } else {
      console.error('❌ Error removing user:', response.statusText)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Main
const args = process.argv.slice(2)
const command = args[0]

if (command === 'list') {
  listUsers()
} else if (command === 'remove') {
  removeUser(args[1])
} else {
  addUser(args[0], args[1])
}
