import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from 'discord.js';
import express from 'express';

// Load environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

// Channel configuration from environment variables
const DISCORD_LISTING_CHANNEL_ID = process.env.DISCORD_LISTING_CHANNEL_ID;
const DISCORD_DISPUTE_CHANNEL_ID = process.env.DISCORD_DISPUTE_CHANNEL_ID;

// Category-specific listing channels
const CATEGORY_LISTING_CHANNELS = {
  'wos_accounts': process.env.DISCORD_LISTING_CHANNEL_WOS_ACCOUNTS,
  'kingshot_accounts': process.env.DISCORD_LISTING_CHANNEL_KINGSHOT_ACCOUNTS,
  'pubg_accounts': process.env.DISCORD_LISTING_CHANNEL_PUBG_ACCOUNTS,
  'fortnite_accounts': process.env.DISCORD_LISTING_CHANNEL_FORTNITE_ACCOUNTS,
  'tiktok_accounts': process.env.DISCORD_LISTING_CHANNEL_TIKTOK_ACCOUNTS,
  'instagram_accounts': process.env.DISCORD_LISTING_CHANNEL_INSTAGRAM_ACCOUNTS,
};

// Category-specific dispute channels
const CATEGORY_DISPUTE_CHANNELS = {
  'wos_accounts': process.env.DISCORD_DISPUTE_CHANNEL_WOS_ACCOUNTS,
  'kingshot_accounts': process.env.DISCORD_DISPUTE_CHANNEL_KINGSHOT_ACCOUNTS,
  'pubg_accounts': process.env.DISCORD_DISPUTE_CHANNEL_PUBG_ACCOUNTS,
  'fortnite_accounts': process.env.DISCORD_DISPUTE_CHANNEL_FORTNITE_ACCOUNTS,
  'tiktok_accounts': process.env.DISCORD_DISPUTE_CHANNEL_TIKTOK_ACCOUNTS,
  'instagram_accounts': process.env.DISCORD_DISPUTE_CHANNEL_INSTAGRAM_ACCOUNTS,
};

if (!DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_TOKEN is required in .env file');
  process.exit(1);
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

// Get listing channel ID (category-specific required, no fallback)
function getListingChannelId(category = null) {
  if (!category) {
    // If no category, use general channel
    return DISCORD_LISTING_CHANNEL_ID || null;
  }
  
  // Each category must have its own channel - no fallback to general
  return CATEGORY_LISTING_CHANNELS[category] || null;
}

// Get dispute channel ID (category-specific required, no fallback)
function getDisputeChannelId(category = null) {
  if (!category) {
    // If no category, use general channel
    return DISCORD_DISPUTE_CHANNEL_ID || null;
  }
  
  // Each category must have its own dispute channel - no fallback
  return CATEGORY_DISPUTE_CHANNELS[category] || null;
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// Bot ready event
client.once('ready', async () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
  console.log(`📊 Bot is in ${client.guilds.cache.size} server(s)`);

  // Log channel configuration
  console.log('\n📋 Channel Configuration:');
  
  // Check if general channels are configured (for non-category listings)
  if (DISCORD_LISTING_CHANNEL_ID) {
    console.log(`   ✅ General Listing Channel: ${DISCORD_LISTING_CHANNEL_ID}`);
  }
  
  if (DISCORD_DISPUTE_CHANNEL_ID) {
    console.log(`   ✅ General Dispute Channel: ${DISCORD_DISPUTE_CHANNEL_ID}`);
  }
  
  console.log('\n📂 Category-Specific Channels (Each game has separate channels):');
  let configuredCount = 0;
  for (const [category, channelId] of Object.entries(CATEGORY_LISTING_CHANNELS)) {
    const disputeChannelId = CATEGORY_DISPUTE_CHANNELS[category];
    if (channelId && disputeChannelId) {
      console.log(`   ✅ ${getCategoryName(category)}:`);
      console.log(`      📢 Listing: ${channelId}`);
      console.log(`      ⚖️  Dispute: ${disputeChannelId}`);
      configuredCount++;
    } else if (channelId || disputeChannelId) {
      console.log(`   ⚠️  ${getCategoryName(category)}: Incomplete configuration`);
      if (channelId) {
        console.log(`      📢 Listing: ${channelId} ✅`);
      } else {
        console.log(`      📢 Listing: ❌ Not configured`);
      }
      if (disputeChannelId) {
        console.log(`      ⚖️  Dispute: ${disputeChannelId} ✅`);
      } else {
        console.log(`      ⚖️  Dispute: ❌ Not configured`);
      }
    }
  }
  
  if (configuredCount === 0) {
    console.log(`   ⚠️  No category-specific channels configured`);
    console.log(`   ⚠️  Each game should have its own listing and dispute channels`);
  } else {
    console.log(`\n   ✅ ${configuredCount} game(s) fully configured`);
  }
  
  console.log('');

  // Start Express server for webhooks
  startWebhookServer();
});

// Webhook server
function startWebhookServer() {
  const app = express();
  app.use(express.json());

  // Unified webhook endpoint for all events
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
            console.log(`⚠️  Unknown event type: ${event_type}`);
            return res.status(400).json({ error: `Unknown event type: ${event_type}` });
        }

        res.json({ 
          success: true, 
          event_type,
          ...(result && { result }) // Include thread info for disputes
        });
      } catch (error) {
        console.error(`❌ Error handling ${event_type}:`, error);
        res.status(500).json({ 
          success: false,
          error: error.message,
          event_type 
        });
      }
    } catch (error) {
      console.error('❌ Webhook error:', error);
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

      const channelId = getListingChannelId(listing.category);
      if (!channelId) {
        const category = listing.category;
        const categoryName = category ? getCategoryName(category) : 'general';
        const envVar = category ? `DISCORD_LISTING_CHANNEL_${category.toUpperCase().replace(/-/g, '_')}` : 'DISCORD_LISTING_CHANNEL_ID';
        return res.status(500).json({ 
          error: `No listing channel configured for ${categoryName}. Set ${envVar} in .env` 
        });
      }

        try {
          const discordChannel = await client.channels.fetch(channelId);
          
          const embed = new EmbedBuilder()
            .setTitle('🆕 New Listing Available!')
            .setDescription(`**${listing.title}**`)
            .addFields(
              { name: '💰 Price', value: `$${parseFloat(listing.price).toFixed(2)}`, inline: true },
              { name: '📂 Category', value: listing.category || 'N/A', inline: true },
            )
          .setColor(0x00AE86)
            .setTimestamp(new Date(listing.created_at || Date.now()))
            .setFooter({ text: 'NXOLand Marketplace' });

          if (listing.description) {
            const description = listing.description.length > 1000 
              ? listing.description.substring(0, 997) + '...' 
              : listing.description;
            embed.addFields({ name: '📝 Description', value: description });
          }

          if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
            embed.setImage(listing.images[0]);
          }

          const listingUrl = `${FRONTEND_URL}/product/${listing.id}`;
          embed.setURL(listingUrl);
          embed.addFields({ name: '🔗 View Listing', value: `[Click here to view](${listingUrl})` });

          await discordChannel.send({ embeds: [embed] });
        res.json({ success: true, sentTo: channelId });
        } catch (error) {
        console.error(`❌ Error sending to channel ${channelId}:`, error);
        res.status(500).json({ error: 'Failed to send to channel', message: error.message });
      }
    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Event handlers
  async function handleListingCreated(listing) {
    let sentCount = 0;

    // Handle both new format (from ListingEventEmitter) and legacy format
    const listingId = listing.listing_id || listing.id;
    const title = listing.title || 'Untitled';
    const price = listing.price || 0;
    const category = listing.category || null;
    const description = listing.description || null;
    const images = listing.images || [];
    const createdAt = listing.created_at || new Date().toISOString();

    const channelId = getListingChannelId(category);
    if (!channelId) {
      const categoryName = category ? getCategoryName(category) : 'general';
      console.warn(`⚠️  No listing channel configured for ${categoryName}.`);
      console.warn(`   Configure DISCORD_LISTING_CHANNEL_${category ? category.toUpperCase().replace(/-/g, '_') : 'ID'} in .env`);
      return;
    }

      try {
        const discordChannel = await client.channels.fetch(channelId);
        
        const embed = new EmbedBuilder()
          .setTitle('🆕 New Listing Available!')
          .setDescription(`**${title}**`)
          .addFields(
            { name: '💰 Price', value: `$${parseFloat(price).toFixed(2)}`, inline: true },
          { name: '📂 Category', value: category || 'N/A', inline: true },
          )
        .setColor(0x00AE86)
          .setTimestamp(new Date(createdAt))
          .setFooter({ text: 'NXOLand Marketplace' });

        if (description) {
          const truncatedDescription = description.length > 1000 
            ? description.substring(0, 997) + '...' 
            : description;
          embed.addFields({ name: '📝 Description', value: truncatedDescription });
        }

        if (images && Array.isArray(images) && images.length > 0) {
          embed.setImage(images[0]);
        }

        const listingUrl = `${FRONTEND_URL}/product/${listingId}`;
        embed.setURL(listingUrl);
        embed.addFields({ name: '🔗 View Listing', value: `[Click here to view](${listingUrl})` });

        await discordChannel.send({ embeds: [embed] });
        sentCount++;
      console.log(`✅ Listing ${listingId} sent to channel ${channelId}`);
      } catch (error) {
      console.error(`❌ Error sending listing to channel ${channelId}:`, error.message);
      console.error('Full error:', error);
    }

    if (sentCount === 0) {
      console.warn(`⚠️  Listing ${listingId} was not sent. Check channel configuration.`);
    } else {
    console.log(`✅ Listing created event processed. Sent to ${sentCount} channel(s)`);
    }
  }

  async function handleListingUpdated(listing) {
    console.log('📝 Listing updated:', listing.listing_id || listing.id);
  }

  async function handleDisputeCreated(dispute) {
    const category = dispute.category || null;
    const channelId = getDisputeChannelId(category);
    
      if (!channelId) {
      const categoryName = category ? getCategoryName(category) : 'general';
      console.warn(`⚠️  No dispute channel configured for ${categoryName}.`);
      console.warn(`   Configure DISCORD_DISPUTE_CHANNEL_${category?.toUpperCase() || 'ID'} in .env`);
      return null;
      }

      try {
        const discordChannel = await client.channels.fetch(channelId);
        
      // Ensure channel supports threads
        if (!discordChannel.isThread() && !discordChannel.threads) {
          console.error(`❌ Channel ${channelId} does not support threads`);
        return null;
        }
        
        if (discordChannel.type !== ChannelType.GuildText && discordChannel.type !== ChannelType.GuildForum) {
          console.error(`❌ Channel ${channelId} type (${discordChannel.type}) does not support private threads. Must be Text Channel or Forum Channel.`);
        return null;
        }
        
      // Create a PRIVATE thread for the dispute
        const threadName = `Dispute #${dispute.dispute_id} - Order #${dispute.order_id}${category ? ` (${getCategoryName(category)})` : ''}`;
        const thread = await discordChannel.threads.create({
          name: threadName,
        type: ChannelType.PrivateThread,
          autoArchiveDuration: 1440, // 24 hours
          reason: 'New dispute created - private communication between buyer and seller',
        });

      // Add buyer and seller to thread
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

        // Get guild to find admin role
        const guild = discordChannel.guild;
        let adminMention = '';
        
        const adminRoleNames = ['Admin', 'Administrators', 'Staff', 'Mod', 'Moderator', 'أدمن', 'إدارة'];
        let adminRole = null;
        
        for (const roleName of adminRoleNames) {
          adminRole = guild.roles.cache.find(role => 
            role.name.toLowerCase().includes(roleName.toLowerCase()) || 
            role.name.toLowerCase() === roleName.toLowerCase()
          );
          if (adminRole) break;
        }
        
        if (adminRole) {
          adminMention = `<@&${adminRole.id}>`;
        } else {
          adminMention = '@everyone';
        }

        // Mention buyer, seller, and admins
        let mentions = [];
        if (dispute.buyer_discord_id) {
          mentions.push(`<@${dispute.buyer_discord_id}>`);
        }
        if (dispute.seller_discord_id) {
          mentions.push(`<@${dispute.seller_discord_id}>`);
        }
        if (adminMention) {
          mentions.push(adminMention);
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
        
        return {
          thread_id: thread.id,
          channel_id: channelId,
        guild_id: guild.id,
        thread_url: `https://discord.com/channels/${guild.id}/${thread.id}`,
        };
      } catch (error) {
      console.error(`❌ Error creating dispute thread in channel ${channelId}:`, error);
        throw error;
    }
  }

  async function handleDisputeUpdated(dispute) {
    console.log(`📝 Dispute #${dispute.dispute_id} updated:`, dispute.status);
  }

  async function handleDisputeResolved(dispute) {
    const category = dispute.category || null;
    
    // Try to find and send message to the existing thread
    if (dispute.discord_thread_id && dispute.discord_channel_id) {
      try {
        const thread = await client.channels.fetch(dispute.discord_thread_id);
        
        if (thread && thread.isThread()) {
          const guild = thread.guild;
          let adminMention = '';
          
          const adminRoleNames = ['Admin', 'Administrators', 'Staff', 'Mod', 'Moderator', 'أدمن', 'إدارة'];
          let adminRole = null;
          
          for (const roleName of adminRoleNames) {
            adminRole = guild.roles.cache.find(role => 
              role.name.toLowerCase().includes(roleName.toLowerCase()) || 
              role.name.toLowerCase() === roleName.toLowerCase()
            );
            if (adminRole) break;
          }
          
          if (adminRole) {
            adminMention = `<@&${adminRole.id}>`;
          }

          let resolutionText = '';
          let resolutionColor = 0x51CF66;
          
          if (dispute.resolution === 'buyer') {
            resolutionText = '✅ **Resolved in favor of BUYER**';
            resolutionColor = 0x4A90E2;
          } else if (dispute.resolution === 'seller') {
            resolutionText = '✅ **Resolved in favor of SELLER**';
            resolutionColor = 0xFFA500;
          } else if (dispute.resolution === 'refund') {
            resolutionText = '✅ **Resolved: REFUND**';
            resolutionColor = 0x51CF66;
          } else {
            resolutionText = '✅ **Dispute Resolved**';
          }

          const embed = new EmbedBuilder()
            .setTitle(`✅ Dispute Resolved`)
            .setDescription(`**Dispute #${dispute.dispute_id}** has been resolved`)
            .addFields(
              { name: '📦 Order ID', value: `#${dispute.order_id}`, inline: true },
              { name: '⚖️ Resolution', value: resolutionText, inline: false },
              { name: '👤 Resolved By', value: dispute.resolver_username || 'Admin', inline: true },
              { name: '📝 Resolution Notes', value: dispute.resolution_notes || 'No notes provided', inline: false },
            )
            .setColor(resolutionColor)
            .setTimestamp(new Date(dispute.resolved_at || Date.now()))
            .setFooter({ text: 'NXOLand Dispute System' });

          let mentions = [];
          if (dispute.buyer_discord_id) {
            mentions.push(`<@${dispute.buyer_discord_id}>`);
          }
          if (dispute.seller_discord_id) {
            mentions.push(`<@${dispute.seller_discord_id}>`);
          }
          if (adminMention) {
            mentions.push(adminMention);
          }

          const mentionText = mentions.length > 0 ? `${mentions.join(' ')}\n\n` : '';
          await thread.send({
            content: mentionText + resolutionText,
            embeds: [embed],
          });

          console.log(`✅ Dispute #${dispute.dispute_id} resolution posted to thread ${dispute.discord_thread_id}`);
          return;
        }
      } catch (error) {
        console.error(`❌ Error posting to thread ${dispute.discord_thread_id}:`, error.message);
      }
    }
    
    // Fallback: Send to dispute channel if thread not found
    const channelId = getDisputeChannelId(category);
    if (!channelId) {
      const categoryName = category ? getCategoryName(category) : 'general';
      console.warn(`⚠️  No dispute channel configured for ${categoryName}.`);
      console.warn(`   Configure DISCORD_DISPUTE_CHANNEL_${category?.toUpperCase() || 'ID'} in .env`);
      return;
    }

      try {
        const discordChannel = await client.channels.fetch(channelId);
        
        let resolutionText = '';
        let resolutionColor = 0x51CF66;
        
        if (dispute.resolution === 'buyer') {
          resolutionText = '✅ **Resolved in favor of BUYER**';
          resolutionColor = 0x4A90E2;
        } else if (dispute.resolution === 'seller') {
          resolutionText = '✅ **Resolved in favor of SELLER**';
          resolutionColor = 0xFFA500;
        } else if (dispute.resolution === 'refund') {
          resolutionText = '✅ **Resolved: REFUND**';
          resolutionColor = 0x51CF66;
        } else {
          resolutionText = '✅ **Dispute Resolved**';
        }

        const embed = new EmbedBuilder()
          .setTitle(`✅ Dispute Resolved`)
          .setDescription(`**Dispute #${dispute.dispute_id}** has been resolved`)
          .addFields(
            { name: '📦 Order ID', value: `#${dispute.order_id}`, inline: true },
            { name: '⚖️ Resolution', value: resolutionText, inline: false },
            { name: '👤 Resolved By', value: dispute.resolver_username || 'Admin', inline: true },
            { name: '📝 Notes', value: dispute.resolution_notes || 'No notes provided', inline: false },
          )
          .setColor(resolutionColor)
          .setTimestamp(new Date(dispute.resolved_at || Date.now()))
          .setFooter({ text: 'NXOLand Dispute System' });

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

        console.log(`✅ Dispute #${dispute.dispute_id} resolution posted to channel ${channelId} (fallback)`);
      } catch (error) {
      console.error(`❌ Error posting dispute resolution to channel ${channelId}:`, error);
    }
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    const config = {
      listing: {
        general: DISCORD_LISTING_CHANNEL_ID || 'Not configured',
        categories: Object.fromEntries(
          Object.entries(CATEGORY_LISTING_CHANNELS).map(([cat, id]) => [cat, id || 'Not configured'])
        ),
      },
      dispute: {
        general: DISCORD_DISPUTE_CHANNEL_ID || 'Not configured',
        categories: Object.fromEntries(
          Object.entries(CATEGORY_DISPUTE_CHANNELS).map(([cat, id]) => [cat, id || 'Not configured'])
        ),
      },
    };
    
    res.json({ 
      status: 'ok', 
      guilds: client.guilds.cache.size,
      configuration: config,
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
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Login to Discord
client.login(DISCORD_TOKEN);
