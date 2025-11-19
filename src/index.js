import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from 'discord.js';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (!DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_TOKEN is required in .env file');
  process.exit(1);
}

// Configuration file path
const CONFIG_PATH = path.join(__dirname, '../config.json');

// Load or create config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return {};
}

// Save config
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Get channel ID for a guild
function getChannelId(guildId) {
  const config = loadConfig();
  return config[guildId]?.channelId || null;
}

// Set channel ID for a guild
function setChannelId(guildId, channelId) {
  const config = loadConfig();
  if (!config[guildId]) {
    config[guildId] = {};
  }
  config[guildId].channelId = channelId;
  saveConfig(config);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// Slash commands
const commands = [
  {
    name: 'setchannel',
    description: 'Set the channel where new listings will be posted',
    options: [
      {
        name: 'channel',
        type: 7, // CHANNEL
        description: 'The channel to post new listings to',
        required: true,
      },
    ],
  },
  {
    name: 'getchannel',
    description: 'Get the current channel where listings are posted',
  },
  {
    name: 'removechannel',
    description: 'Remove the channel configuration (disable notifications)',
  },
];

// Register slash commands when bot is ready
client.once('ready', async () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
  console.log(`📊 Bot is in ${client.guilds.cache.size} server(s)`);

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    console.log('🔄 Registering slash commands...');
    
    const clientId = client.user.id;
    
    // Register commands globally (takes up to 1 hour to propagate)
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    const commandsData = await rest.get(Routes.applicationCommands(clientId));
    console.log(`✅ Registered ${commandsData.length} command(s) globally`);
    console.log('   Commands:', commandsData.map(cmd => `/${cmd.name}`).join(', '));
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }

  // Start Express server for webhooks
  startWebhookServer();
});

// Handle interactions (slash commands)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, channel } = interaction;

  if (commandName === 'setchannel') {
    const targetChannel = interaction.options.getChannel('channel');

    if (!targetChannel) {
      return interaction.reply({
        content: '❌ Please specify a valid channel.',
        ephemeral: true,
      });
    }

    // Check if bot has permission to send messages in the channel
    const permissions = targetChannel.permissionsFor(client.user);
    if (!permissions || !permissions.has('SendMessages')) {
      return interaction.reply({
        content: `❌ I don't have permission to send messages in ${targetChannel}. Please check my permissions.`,
        ephemeral: true,
      });
    }

    setChannelId(guildId, targetChannel.id);

    await interaction.reply({
      content: `✅ New listings will now be posted to ${targetChannel}!`,
      ephemeral: true,
    });

    // Send a test message to confirm
    try {
      await targetChannel.send('🎉 **Channel configured!** New listings from NXOLand will be posted here.');
    } catch (error) {
      console.error('Error sending test message:', error);
    }
  } else if (commandName === 'getchannel') {
    const channelId = getChannelId(guildId);

    if (!channelId) {
      return interaction.reply({
        content: '❌ No channel is configured. Use `/setchannel` to set one.',
        ephemeral: true,
      });
    }

    try {
      const targetChannel = await client.channels.fetch(channelId);
      await interaction.reply({
        content: `✅ Current notification channel: ${targetChannel}`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `⚠️ Channel ID is set (${channelId}) but I cannot access it. It may have been deleted. Use `/setchannel` to update.`,
        ephemeral: true,
      });
    }
  } else if (commandName === 'removechannel') {
    const config = loadConfig();
    if (config[guildId]) {
      delete config[guildId];
      saveConfig(config);
      await interaction.reply({
        content: '✅ Channel configuration removed. Notifications are now disabled.',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: '❌ No channel is configured.',
        ephemeral: true,
      });
    }
  }
});

// Move webhook server to a function so it starts after bot is ready
function startWebhookServer() {
  // Express server setup
  const app = express();
  app.use(express.json());

  // Webhook endpoint for listing notifications
  app.post('/webhook/listing', async (req, res) => {
    // Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers['x-webhook-secret'];
      if (authHeader !== WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    try {
      const listing = req.body;

      // Validate required fields
      if (!listing.id || !listing.title || !listing.price) {
        return res.status(400).json({ error: 'Invalid listing data' });
      }

      // Send to all configured channels
      const config = loadConfig();
      let sentCount = 0;
      const errors = [];

      for (const [guildId, guildConfig] of Object.entries(config)) {
        const channelId = guildConfig.channelId;
        if (!channelId) continue;

        try {
          const discordChannel = await client.channels.fetch(channelId);
          
          // Create rich embed
          const embed = new EmbedBuilder()
            .setTitle('🆕 New Listing Available!')
            .setDescription(`**${listing.title}**`)
            .addFields(
              { name: '💰 Price', value: `$${parseFloat(listing.price).toFixed(2)}`, inline: true },
              { name: '📂 Category', value: listing.category || 'N/A', inline: true },
            )
            .setColor(0x00AE86) // NXOLand brand color (teal/green)
            .setTimestamp(new Date(listing.created_at || Date.now()))
            .setFooter({ text: 'NXOLand Marketplace' });

          // Add description if available (truncate if too long)
          if (listing.description) {
            const description = listing.description.length > 1000 
              ? listing.description.substring(0, 997) + '...' 
              : listing.description;
            embed.addFields({ name: '📝 Description', value: description });
          }

          // Add first image if available
          if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
            embed.setImage(listing.images[0]);
          }

          // Add link to view listing
          const listingUrl = `${FRONTEND_URL}/product/${listing.id}`;
          embed.setURL(listingUrl);
          embed.addFields({ name: '🔗 View Listing', value: `[Click here to view](${listingUrl})` });

          await discordChannel.send({ embeds: [embed] });
          sentCount++;
        } catch (error) {
          console.error(`Error sending to channel ${channelId} in guild ${guildId}:`, error);
          errors.push({ guildId, channelId, error: error.message });
        }
      }

      if (sentCount === 0 && Object.keys(config).length > 0) {
        return res.status(500).json({ 
          error: 'Failed to send to any channels',
          errors 
        });
      }

      res.json({ 
        success: true, 
        sentTo: sentCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      guilds: client.guilds.cache.size,
      configuredChannels: Object.keys(loadConfig()).length
    });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Webhook server running on port ${PORT}`);
    console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook/listing`);
  });
}

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(DISCORD_TOKEN);

