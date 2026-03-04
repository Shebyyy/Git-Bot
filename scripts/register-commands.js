import { REST, Routes } from 'discord.js'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'

// Load environment variables
dotenv.config()

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('ERROR: DISCORD_TOKEN and DISCORD_CLIENT_ID are required in .env file')
  process.exit(1)
}

// Define slash commands
const commands = [
  // /sync command
  {
    name: 'sync',
    description: 'Sync your fork with the upstream repository',
  },
  
  // /tags command group
  {
    name: 'tags',
    description: 'Manage repository tags',
    options: [
      {
        name: 'list',
        description: 'List all tags in the repository',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'create',
        description: 'Create a new tag',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Tag name (e.g., v1.0.0)',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'message',
            description: 'Tag message (optional)',
            type: 3, // STRING
            required: false,
          },
        ],
      },
      {
        name: 'delete',
        description: 'Delete a tag',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Tag name to delete',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },
  
  // /branches command
  {
    name: 'branches',
    description: 'List all branches with protection status',
  },
  
  // /prs command group
  {
    name: 'prs',
    description: 'Manage pull requests',
    options: [
      {
        name: 'list',
        description: 'List pull requests',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'state',
            description: 'Filter by state (default: open)',
            type: 3, // STRING
            required: false,
            choices: [
              { name: 'Open', value: 'open' },
              { name: 'Closed', value: 'closed' },
              { name: 'All', value: 'all' },
            ],
          },
        ],
      },
      {
        name: 'view',
        description: 'View details of a specific pull request',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'number',
            description: 'Pull request number',
            type: 4, // INTEGER
            required: true,
          },
        ],
      },
    ],
  },
]

// Initialize REST API
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN)

async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands...')
    
    let data
    if (DISCORD_GUILD_ID) {
      // Register commands for a specific guild (faster for testing)
      console.log(`Registering commands for guild: ${DISCORD_GUILD_ID}`)
      data = await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
        { body: commands }
      )
    } else {
      // Register global commands (takes up to 1 hour to propagate)
      console.log('Registering global commands')
      data = await rest.put(
        Routes.applicationCommands(DISCORD_CLIENT_ID),
        { body: commands }
      )
    }
    
    console.log(`Successfully reloaded ${data.length} application (/) commands.`)
    console.log('Commands registered:')
    data.forEach((cmd) => {
      console.log(`  - /${cmd.name}`)
      if (cmd.options) {
        cmd.options.forEach((opt) => {
          if (opt.type === 1) {
            console.log(`    - ${opt.name}`)
            if (opt.options) {
              opt.options.forEach((subOpt) => {
                console.log(`      - ${subOpt.name}: ${subOpt.description}`)
              })
            }
          }
        })
      }
    })
    
  } catch (error) {
    console.error('Error registering commands:', error)
    process.exit(1)
  }
}

registerCommands()
