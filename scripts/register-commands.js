import { REST, Routes } from 'discord.js'
import dotenv from 'dotenv'

dotenv.config()

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('ERROR: DISCORD_TOKEN and DISCORD_CLIENT_ID are required in .env file')
  process.exit(1)
}

const commands = [
  // ==================== CORE COMMANDS ====================
  
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

  // /branches command group
  {
    name: 'branches',
    description: 'Manage repository branches',
    options: [
      {
        name: 'list',
        description: 'List all branches with protection status',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'create',
        description: 'Create a new branch',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Branch name',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'sha',
            description: 'Commit SHA to branch from (optional)',
            type: 3, // STRING
            required: false,
          },
        ],
      },
      {
        name: 'delete',
        description: 'Delete a branch',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Branch name to delete',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'protect',
        description: 'Protect a branch (require reviews)',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Branch name to protect',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'unprotect',
        description: 'Unprotect a branch',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Branch name to unprotect',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
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
      {
        name: 'merge',
        description: 'Merge a pull request',
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
      {
        name: 'approve',
        description: 'Approve a pull request',
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
      {
        name: 'review',
        description: 'Add review comment to PR',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'number',
            description: 'Pull request number',
            type: 4, // INTEGER
            required: true,
          },
          {
            name: 'comment',
            description: 'Review comment',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'close',
        description: 'Close a pull request',
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

  // ==================== USER MANAGEMENT (OWNER/Admin Only) ====================
  
  {
    name: 'users',
    description: 'Manage bot users (owner/admin only)',
    options: [
      {
        name: 'list',
        description: 'List all users with roles',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'add',
        description: 'Add a new user',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'user_id',
            description: 'Discord user ID',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'username',
            description: 'Discord username',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'role',
            description: 'User role (default: user)',
            type: 3, // STRING
            required: false,
            choices: [
              { name: 'User', value: 'user' },
              { name: 'Admin', value: 'admin' },
            ],
          },
        ],
      },
      {
        name: 'remove',
        description: 'Remove a user',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'user_id',
            description: 'Discord user ID',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'promote',
        description: 'Promote user to admin',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'user_id',
            description: 'Discord user ID',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'demote',
        description: 'Demote admin to user',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'user_id',
            description: 'Discord user ID',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== RELEASE MANAGEMENT ====================
  
  {
    name: 'releases',
    description: 'Manage GitHub releases',
    options: [
      {
        name: 'list',
        description: 'List all releases',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'create',
        description: 'Create a new release',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Tag name',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'name',
            description: 'Release name',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'body',
            description: 'Release notes',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'delete',
        description: 'Delete a release',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Tag name',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'view',
        description: 'View release details',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Tag name',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== ISSUE MANAGEMENT ====================
  
  {
    name: 'issues',
    description: 'Manage GitHub issues',
    options: [
      {
        name: 'list',
        description: 'List issues',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'state',
            description: 'Filter by state',
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
        name: 'create',
        description: 'Create a new issue',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'title',
            description: 'Issue title',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'view',
        description: 'View issue details',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'number',
            description: 'Issue number',
            type: 4, // INTEGER
            required: true,
          },
        ],
      },
      {
        name: 'close',
        description: 'Close an issue',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'number',
            description: 'Issue number',
            type: 4, // INTEGER
            required: true,
          },
        ],
      },
      {
        name: 'comment',
        description: 'Add comment to issue',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'number',
            description: 'Issue number',
            type: 4, // INTEGER
            required: true,
          },
          {
            name: 'comment',
            description: 'Comment text',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== COMMIT HISTORY ====================
  
  {
    name: 'commits',
    description: 'View commit history',
    options: [
      {
        name: 'list',
        description: 'Show recent commits',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'branch',
            description: 'Branch name (default: main)',
            type: 3, // STRING
            required: false,
          },
        ],
      },
      {
        name: 'view',
        description: 'View commit details',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'sha',
            description: 'Commit SHA',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'diff',
        description: 'Compare two commits',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'sha1',
            description: 'First commit SHA',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'sha2',
            description: 'Second commit SHA',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== SCHEDULED TASKS ====================
  
  {
    name: 'schedule',
    description: 'Manage scheduled tasks',
    options: [
      {
        name: 'sync',
        description: 'Schedule daily auto-sync',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'list',
        description: 'List all scheduled tasks',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'remove',
        description: 'Remove a scheduled task',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'id',
            description: 'Task ID',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== FILE OPERATIONS ====================
  
  {
    name: 'files',
    description: 'View repository files',
    options: [
      {
        name: 'list',
        description: 'List files in directory',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'branch',
            description: 'Branch name',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'path',
            description: 'File path (optional)',
            type: 3, // STRING
            required: false,
          },
        ],
      },
      {
        name: 'view',
        description: 'View file content',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'branch',
            description: 'Branch name',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'path',
            description: 'File path',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== STATISTICS ====================
  
  {
    name: 'stats',
    description: 'Show repository statistics',
  },

  // ==================== LABELS ====================
  
  {
    name: 'labels',
    description: 'Manage issue/PR labels',
    options: [
      {
        name: 'list',
        description: 'List all labels',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'create',
        description: 'Create a new label',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Label name',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'color',
            description: 'Label color (hex, e.g., FF0000)',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'delete',
        description: 'Delete a label',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Label name',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== MULTI-REPOSITORY ====================
  
  {
    name: 'repo',
    description: 'Manage multiple repositories',
    options: [
      {
        name: 'add',
        description: 'Add a repository',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'owner',
            description: 'Repository owner',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'name',
            description: 'Repository name',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'alias',
            description: 'Repository alias (optional)',
            type: 3, // STRING
            required: false,
          },
        ],
      },
      {
        name: 'remove',
        description: 'Remove a repository',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'alias',
            description: 'Repository alias',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'list',
        description: 'List all repositories',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'switch',
        description: 'Switch active repository',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'alias',
            description: 'Repository alias',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== WEBHOOKS ====================
  
  {
    name: 'webhooks',
    description: 'Manage repository webhooks',
    options: [
      {
        name: 'list',
        description: 'List all webhooks',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'create',
        description: 'Create a webhook',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'url',
            description: 'Webhook URL',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'delete',
        description: 'Delete a webhook',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'id',
            description: 'Webhook ID',
            type: 4, // INTEGER
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== COLLABORATORS ====================
  
  {
    name: 'collaborators',
    description: 'Manage repository collaborators',
    options: [
      {
        name: 'list',
        description: 'List all collaborators',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'add',
        description: 'Add a collaborator',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'username',
            description: 'GitHub username',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'role',
            description: 'Permission level',
            type: 3, // STRING
            required: true,
            choices: [
              { name: 'Read', value: 'pull' },
              { name: 'Write', value: 'push' },
              { name: 'Admin', value: 'admin' },
            ],
          },
        ],
      },
      {
        name: 'remove',
        description: 'Remove a collaborator',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'username',
            description: 'GitHub username',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== MILESTONES ====================
  
  {
    name: 'milestones',
    description: 'Manage repository milestones',
    options: [
      {
        name: 'list',
        description: 'List milestones',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'state',
            description: 'Filter by state',
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
        name: 'create',
        description: 'Create a milestone',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'title',
            description: 'Milestone title',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'due_date',
            description: 'Due date (YYYY-MM-DD)',
            type: 3, // STRING
            required: false,
          },
        ],
      },
      {
        name: 'close',
        description: 'Close a milestone',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'number',
            description: 'Milestone number',
            type: 4, // INTEGER
            required: true,
          },
        ],
      },
    ],
  },

  // ==================== SEARCH ====================
  
  {
    name: 'search',
    description: 'Search repository',
    options: [
      {
        name: 'issues',
        description: 'Search issues',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'query',
            description: 'Search query',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'code',
        description: 'Search code',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'query',
            description: 'Search query',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'commits',
        description: 'Search commits',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'query',
            description: 'Search query',
            type: 3, // STRING
            required: true,
          },
        ],
      },
    ],
  },
]

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN)

async function registerCommands() {
  try {
    console.log('🚀 Started refreshing application (/) commands...')
    console.log(`📝 Registering ${commands.length} command groups with ${commands.reduce((acc, cmd) => acc + (cmd.options?.length || 0), 0)} total commands`)
    
    let data
    if (DISCORD_GUILD_ID) {
      console.log(`🔧 Registering commands for guild: ${DISCORD_GUILD_ID}`)
      data = await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
        { body: commands }
      )
    } else {
      console.log('🌐 Registering global commands')
      data = await rest.put(
        Routes.applicationCommands(DISCORD_CLIENT_ID),
        { body: commands }
      )
    }
    
    console.log(`\n✅ Successfully reloaded ${data.length} application (/) commands.\n`)
    console.log('📋 Commands registered:')
    data.forEach((cmd) => {
      console.log(`  - /${cmd.name}`)
      if (cmd.options) {
        cmd.options.forEach((opt) => {
          if (opt.type === 1) {
            console.log(`    └─ ${opt.name}`)
            if (opt.options) {
              opt.options.forEach((subOpt) => {
                console.log(`       └─ ${subOpt.name}: ${subOpt.description}`)
              })
            }
          }
        })
      }
    })
    
    console.log('\n🎉 Bot is ready to use!')
    
  } catch (error) {
    console.error('❌ Error registering commands:', error)
    process.exit(1)
  }
}

registerCommands()
