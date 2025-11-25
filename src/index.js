import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ChannelType } from 'discord.js';
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

// Get channel ID for a guild (general or category-specific)
function getChannelId(guildId, category = null) {
  const config = loadConfig();
  if (!config[guildId]) return null;
  
  // If category is specified, try to get category-specific channel
  if (category && config[guildId].categoryChannels && config[guildId].categoryChannels[category]) {
    return config[guildId].categoryChannels[category];
  }
  
  // Fallback to general channel
  return config[guildId].channelId || null;
}

// Set channel ID for a guild (general or category-specific)
function setChannelId(guildId, channelId, category = null) {
  const config = loadConfig();
  if (!config[guildId]) {
    config[guildId] = {};
  }
  
  if (category) {
    // Set category-specific channel
    if (!config[guildId].categoryChannels) {
      config[guildId].categoryChannels = {};
    }
    config[guildId].categoryChannels[category] = channelId;
  } else {
    // Set general channel
    config[guildId].channelId = channelId;
  }
  
  saveConfig(config);
}

// Get category name from category code
function getCategoryName(category) {
  const categoryMap = {
    'wos_accounts': 'Whiteout Survival',
    'kingshot_accounts': 'KingShot',
    'pubg_accounts': 'PUBG Mobile',
    'fortnite_accounts': 'Fortnite',
    'tiktok_accounts': 'TikTok',
    'instagram_accounts': 'Instagram',
  };
  return categoryMap[category] || category;
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
      {
        name: 'category',
        type: 3, // STRING
        description: 'Category for category-specific channel (wos_accounts, kingshot_accounts, pubg_accounts, fortnite_accounts)',
        required: false,
        choices: [
          { name: 'Whiteout Survival', value: 'wos_accounts' },
          { name: 'KingShot', value: 'kingshot_accounts' },
          { name: 'PUBG Mobile', value: 'pubg_accounts' },
          { name: 'Fortnite', value: 'fortnite_accounts' },
          { name: 'TikTok', value: 'tiktok_accounts' },
          { name: 'Instagram', value: 'instagram_accounts' },
        ],
      },
    ],
  },
  {
    name: 'getchannel',
    description: 'Get the current channel where listings are posted',
    options: [
      {
        name: 'category',
        type: 3, // STRING
        description: 'Category to get channel for',
        required: false,
        choices: [
          { name: 'Whiteout Survival', value: 'wos_accounts' },
          { name: 'KingShot', value: 'kingshot_accounts' },
          { name: 'PUBG Mobile', value: 'pubg_accounts' },
          { name: 'Fortnite', value: 'fortnite_accounts' },
          { name: 'TikTok', value: 'tiktok_accounts' },
          { name: 'Instagram', value: 'instagram_accounts' },
        ],
      },
    ],
  },
  {
    name: 'removechannel',
    description: 'Remove the channel configuration (disable notifications)',
    options: [
      {
        name: 'category',
        type: 3, // STRING
        description: 'Category to remove channel for',
        required: false,
        choices: [
          { name: 'Whiteout Survival', value: 'wos_accounts' },
          { name: 'KingShot', value: 'kingshot_accounts' },
          { name: 'PUBG Mobile', value: 'pubg_accounts' },
          { name: 'Fortnite', value: 'fortnite_accounts' },
          { name: 'TikTok', value: 'tiktok_accounts' },
          { name: 'Instagram', value: 'instagram_accounts' },
        ],
      },
    ],
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
    const category = interaction.options.getString('category');

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

    setChannelId(guildId, targetChannel.id, category);
    const categoryText = category ? ` for ${getCategoryName(category)}` : '';

    await interaction.reply({
      content: `✅ Channel set to ${targetChannel}${categoryText}. New listings will be posted here.`,
      ephemeral: true,
    });

    // Send a test message to confirm
    try {
      await targetChannel.send(`🎉 **Channel configured${categoryText}!** New listings from NXOLand will be posted here.`);
    } catch (error) {
      console.error('Error sending test message:', error);
    }
  } else if (commandName === 'getchannel') {
    const category = interaction.options.getString('category');
    const channelId = getChannelId(guildId, category);

    if (!channelId) {
      const categoryText = category ? ` for ${getCategoryName(category)}` : '';
      return interaction.reply({
        content: `❌ No channel is configured${categoryText}. Use \`/setchannel\` to set one.`,
        ephemeral: true,
      });
    }

    try {
      const targetChannel = await client.channels.fetch(channelId);
      const categoryText = category ? ` (${getCategoryName(category)})` : '';
      await interaction.reply({
        content: `✅ Current notification channel${categoryText}: ${targetChannel}`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `⚠️ Channel ID is set (${channelId}) but I cannot access it. It may have been deleted. Use \`/setchannel\` to update.`,
        ephemeral: true,
      });
    }
  } else if (commandName === 'removechannel') {
    const category = interaction.options.getString('category');
    const config = loadConfig();
    
    if (category) {
      // Remove category-specific channel
      if (!config[guildId] || !config[guildId].categoryChannels || !config[guildId].categoryChannels[category]) {
        return interaction.reply({
          content: `❌ No channel configured for ${getCategoryName(category)}.`,
          ephemeral: true,
        });
      }
      delete config[guildId].categoryChannels[category];
      saveConfig(config);
      return interaction.reply({
        content: `✅ Channel configuration removed for ${getCategoryName(category)}.`,
        ephemeral: true,
      });
    } else {
      // Remove general channel
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
  }
});

// Move webhook server to a function so it starts after bot is ready
function startWebhookServer() {
  // Express server setup
  const app = express();
  app.use(express.json());

  // Unified webhook endpoint for all events (disputes, listings, etc.)
  app.post('/webhook', async (req, res) => {
    // Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers['x-webhook-secret'];
      if (authHeader !== WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    try {
      const { event_type, data } = req.body;

      if (!event_type || !data) {
        return res.status(400).json({ error: 'Invalid event format. Expected event_type and data' });
      }

      // Route to appropriate handler based on event type
      let result = null;
      try {
        switch (event_type) {
          case 'listing.created':
            await handleListingCreated(data);
            break;
          case 'listing.updated':
          case 'listing.status_changed':
            await handleListingUpdated(data);
            break;
          case 'dispute.created':
            result = await handleDisputeCreated(data);
            break;
          case 'dispute.updated':
            await handleDisputeUpdated(data);
            break;
          case 'dispute.resolved':
            await handleDisputeResolved(data);
            break;
          default:
            console.log(`Unknown event type: ${event_type}`);
            return res.status(400).json({ error: `Unknown event type: ${event_type}` });
        }

        res.json({ 
          success: true, 
          event_type,
          ...(result && { result }) // Include thread info for disputes
        });
      } catch (error) {
        console.error(`Error handling ${event_type}:`, error);
        res.status(500).json({ 
          success: false,
          error: error.message,
          event_type 
        });
      }
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  });

  // Legacy endpoint for backward compatibility
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

  // Event handlers
  async function handleListingCreated(listing) {
    const config = loadConfig();
    let sentCount = 0;

    // Handle both new format (from ListingEventEmitter) and legacy format
    // New format has: listing_id, title, category, price, status, created_at
    // Legacy format has: id, title, description, price, category, images, created_at
    const listingId = listing.listing_id || listing.id;
    const title = listing.title || 'Untitled';
    const price = listing.price || 0;
    const category = listing.category || null;
    const description = listing.description || null;
    const images = listing.images || [];
    const createdAt = listing.created_at || new Date().toISOString();

    for (const [guildId, guildConfig] of Object.entries(config)) {
      // Get category-specific channel or fallback to general channel
      const channelId = getChannelId(guildId, category);
      if (!channelId) continue;

      try {
        const discordChannel = await client.channels.fetch(channelId);
        
        const embed = new EmbedBuilder()
          .setTitle('🆕 New Listing Available!')
          .setDescription(`**${title}**`)
          .addFields(
            { name: '💰 Price', value: `$${parseFloat(price).toFixed(2)}`, inline: true },
            { name: '📂 Category', value: category, inline: true },
          )
          .setColor(0x00AE86) // NXOLand brand color (teal/green)
          .setTimestamp(new Date(createdAt))
          .setFooter({ text: 'NXOLand Marketplace' });

        // Add description if available (truncate if too long)
        if (description) {
          const truncatedDescription = description.length > 1000 
            ? description.substring(0, 997) + '...' 
            : description;
          embed.addFields({ name: '📝 Description', value: truncatedDescription });
        }

        // Add first image if available
        if (images && Array.isArray(images) && images.length > 0) {
          embed.setImage(images[0]);
        }

        // Add link to view listing
        const listingUrl = `${FRONTEND_URL}/product/${listingId}`;
        embed.setURL(listingUrl);
        embed.addFields({ name: '🔗 View Listing', value: `[Click here to view](${listingUrl})` });

        await discordChannel.send({ embeds: [embed] });
        sentCount++;
      } catch (error) {
        console.error(`Error sending listing to channel ${channelId}:`, error);
      }
    }

    console.log(`✅ Listing created event processed. Sent to ${sentCount} channel(s)`);
  }

  async function handleListingUpdated(listing) {
    // Handle listing updates (optional - you may not want to notify on every update)
    console.log('📝 Listing updated:', listing.listing_id);
  }

  async function handleDisputeCreated(dispute) {
    const config = loadConfig();
    const category = dispute.category || null;
    
    for (const [guildId, guildConfig] of Object.entries(config)) {
      // Get category-specific channel or fallback to general channel
      const channelId = getChannelId(guildId, category);
      if (!channelId) {
        console.log(`⚠️ No channel configured for category ${category} in guild ${guildId}`);
        continue;
      }

      try {
        const discordChannel = await client.channels.fetch(channelId);
        
        // Ensure channel supports threads (Text Channel or Forum Channel)
        if (!discordChannel.isThread() && !discordChannel.threads) {
          console.error(`❌ Channel ${channelId} does not support threads`);
          continue;
        }
        
        // Check if channel type supports private threads
        // Private threads can only be created in Text Channels or Forum Channels
        if (discordChannel.type !== ChannelType.GuildText && discordChannel.type !== ChannelType.GuildForum) {
          console.error(`❌ Channel ${channelId} type (${discordChannel.type}) does not support private threads. Must be Text Channel or Forum Channel.`);
          continue;
        }
        
        // Create a PRIVATE thread for the dispute (only buyer, seller, and admins can see it)
        // NOTE: Bot needs "Create Private Threads" permission in the channel
        const threadName = `Dispute #${dispute.dispute_id} - Order #${dispute.order_id}${category ? ` (${getCategoryName(category)})` : ''}`;
        const thread = await discordChannel.threads.create({
          name: threadName,
          type: ChannelType.PrivateThread, // Private thread - only added members and admins can see it
          autoArchiveDuration: 1440, // 24 hours
          reason: 'New dispute created - private communication between buyer and seller',
        });

        // Add buyer and seller to thread (they need to be able to communicate)
        if (dispute.buyer_discord_id) {
          try {
            await thread.members.add(dispute.buyer_discord_id, 'Buyer added to dispute thread');
          } catch (error) {
            console.error(`Failed to add buyer to thread:`, error);
          }
        }
        if (dispute.seller_discord_id) {
          try {
            await thread.members.add(dispute.seller_discord_id, 'Seller added to dispute thread');
          } catch (error) {
            console.error(`Failed to add seller to thread:`, error);
          }
        }

        // Mention buyer and seller if they have Discord IDs
        let mentions = [];
        if (dispute.buyer_discord_id) {
          mentions.push(`<@${dispute.buyer_discord_id}>`);
        }
        if (dispute.seller_discord_id) {
          mentions.push(`<@${dispute.seller_discord_id}>`);
        }

        const embed = new EmbedBuilder()
          .setTitle(`⚠️ New Dispute Created`)
          .setDescription(`**Dispute #${dispute.dispute_id}**`)
          .addFields(
            { name: '📦 Order ID', value: `#${dispute.order_id}`, inline: true },
            { name: '👤 Initiated By', value: dispute.party === 'buyer' ? 'Buyer' : 'Seller', inline: true },
            { name: '📂 Category', value: category ? getCategoryName(category) : 'N/A', inline: true },
            { name: '📋 Reason', value: dispute.reason || 'N/A' },
            { name: '📝 Description', value: dispute.description || 'No description provided' },
            { name: '🆔 Buyer Discord', value: dispute.buyer_discord_id ? `<@${dispute.buyer_discord_id}>` : 'Not connected', inline: true },
            { name: '🆔 Seller Discord', value: dispute.seller_discord_id ? `<@${dispute.seller_discord_id}>` : 'Not connected', inline: true },
          )
          .setColor(0xFF6B6B)
          .setTimestamp(new Date(dispute.created_at || Date.now()))
          .setFooter({ text: 'NXOLand Dispute System' });

        const mentionText = mentions.length > 0 ? `${mentions.join(' ')}\n\n` : '';
        await thread.send({
          content: mentionText + '💬 **This is a PRIVATE thread for buyer and seller communication. Only you, the other party, and admins can see this thread.**\n\n🔒 **Privacy:** This thread is private and will not be visible to other server members.',
          embeds: [embed],
        });

        console.log(`✅ Dispute #${dispute.dispute_id} thread created in channel ${channelId} (thread ID: ${thread.id})`);
        
        // Return thread ID, channel ID, and guild ID to backend (via webhook response)
        // The backend will need to handle this response
        return {
          thread_id: thread.id,
          channel_id: channelId,
          guild_id: guildId,
          thread_url: `https://discord.com/channels/${guildId}/${thread.id}`,
        };
      } catch (error) {
        console.error(`Error creating dispute thread in channel ${channelId}:`, error);
        throw error;
      }
    }
  }

  async function handleDisputeUpdated(dispute) {
    // Handle dispute updates (status changes, etc.)
    console.log(`📝 Dispute #${dispute.dispute_id} updated:`, dispute.status);
    // You can add logic here to update the thread with status changes
  }

  async function handleDisputeResolved(dispute) {
    const config = loadConfig();
    
    for (const [guildId, guildConfig] of Object.entries(config)) {
      const channelId = guildConfig.channelId;
      if (!channelId) continue;

      try {
        const discordChannel = await client.channels.fetch(channelId);
        
        // Find existing thread (you may need to store thread IDs)
        // For now, we'll send a message to the channel
        const embed = new EmbedBuilder()
          .setTitle(`✅ Dispute Resolved`)
          .setDescription(`**Dispute #${dispute.dispute_id}** has been resolved`)
          .addFields(
            { name: '📦 Order ID', value: `#${dispute.order_id}`, inline: true },
            { name: '⚖️ Resolution', value: dispute.resolution || 'N/A', inline: true },
            { name: '👤 Resolved By', value: dispute.resolver_username || 'Admin', inline: true },
            { name: '📝 Notes', value: dispute.resolution_notes || 'No notes provided' },
          )
          .setColor(0x51CF66)
          .setTimestamp(new Date(dispute.resolved_at || Date.now()))
          .setFooter({ text: 'NXOLand Dispute System' });

        // Mention parties
        let mentions = [];
        if (dispute.buyer_discord_id) {
          mentions.push(`<@${dispute.buyer_discord_id}>`);
        }
        if (dispute.seller_discord_id) {
          mentions.push(`<@${dispute.seller_discord_id}>`);
        }

        const mentionText = mentions.length > 0 ? `${mentions.join(' ')}\n\n` : '';
        await discordChannel.send({
          content: mentionText,
          embeds: [embed],
        });

        console.log(`✅ Dispute #${dispute.dispute_id} resolution posted to channel ${channelId}`);
      } catch (error) {
        console.error(`Error posting dispute resolution to channel ${channelId}:`, error);
      }
    }
  }

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
    console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
    console.log(`📡 Legacy endpoint: http://localhost:${PORT}/webhook/listing`);
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

