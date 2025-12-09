# NXOBot - Discord Bot for NXOLand Marketplace

A Discord bot that automatically posts new listings from the NXOLand marketplace to configured Discord channels.

## Features

- ✅ **Automatic Notifications**: Receives webhook notifications from Laravel backend when new listings are created
- ✅ **Rich Embeds**: Beautiful Discord embeds with listing details, images, and links
- ✅ **Category-Specific Channels**: Configure different channels for different listing categories
- ✅ **Environment Variable Configuration**: Simple setup via `.env` file - no commands needed
- ✅ **Secure Webhooks**: Optional webhook secret authentication

## Setup

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name (e.g., "NXOBot")
3. Go to the "Bot" section
4. Click "Add Bot" and confirm
5. Under "Privileged Gateway Intents", enable:
   - Server Members Intent (if needed)
6. Copy the **Bot Token** (you'll need this for `.env`)
7. Go to "OAuth2" → "URL Generator"
8. Select scopes:
   - `bot`
9. Select bot permissions:
   - **Send Messages** - Post listings and dispute notifications
   - **Embed Links** - Send rich embeds with listing details
   - **Attach Files** - Show listing images
   - **Read Message History** - Required to create threads
   - **Create Public Threads** - Create dispute threads (REQUIRED for disputes)
   - **Send Messages in Threads** - Post in dispute threads
   - **Use External Emojis** - Use emojis in messages (optional)
   - **View Channels** - See channels in your server
10. Copy the generated URL and open it in your browser to invite the bot to your server(s)

### 2. Install Dependencies

```bash
cd NXOBot
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_LISTING_CHANNEL_ID=your_listing_channel_id_here

# Optional
DISCORD_GUILD_ID=your_discord_guild_id_here
PORT=3000
WEBHOOK_SECRET=your_secure_random_string_here
FRONTEND_URL=https://your-frontend-url.com
DISCORD_DISPUTE_CHANNEL_ID=your_dispute_channel_id_here

# Category-specific channels (optional)
DISCORD_LISTING_CHANNEL_WOS_ACCOUNTS=
DISCORD_LISTING_CHANNEL_KINGSHOT_ACCOUNTS=
DISCORD_LISTING_CHANNEL_PUBG_ACCOUNTS=
# ... etc
```

**Getting Channel IDs:**
1. Enable Developer Mode in Discord: User Settings → Advanced → Developer Mode
2. Right-click on the channel → Copy ID
3. Paste the ID into your `.env` file

**Important:**
- `DISCORD_TOKEN`: The bot token from Discord Developer Portal
- `DISCORD_LISTING_CHANNEL_ID`: **Required** - Channel where listings will be posted
- `DISCORD_DISPUTE_CHANNEL_ID`: Optional - Channel for dispute threads (falls back to listing channel)
- `WEBHOOK_SECRET`: Generate a random string (e.g., using `openssl rand -hex 32`) - should match Laravel `.env`
- `FRONTEND_URL`: Your frontend URL where listings are hosted (e.g., `https://nxoland.com`)

See `DISCORD_BOT_ENV_SETUP.md` for complete configuration guide.

### 4. Start the Bot

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Usage

### Channel Configuration

Channels are configured via environment variables in `.env`. No commands needed!

- **General Listing Channel**: Set `DISCORD_LISTING_CHANNEL_ID` (required)
- **General Dispute Channel**: Set `DISCORD_DISPUTE_CHANNEL_ID` (optional)
- **Category-Specific Channels**: Set `DISCORD_LISTING_CHANNEL_{CATEGORY}` (optional)

The bot will automatically use category-specific channels when available, falling back to general channels.

### Webhook Endpoint

The bot exposes a webhook endpoint at:
```
POST http://localhost:3000/webhook/listing
```

Your Laravel backend will send POST requests to this endpoint when new listings are created.

**Request Body:**
```json
{
  "id": 123,
  "title": "Account Title",
  "description": "Account description...",
  "price": "99.99",
  "category": "Instagram",
  "images": ["https://example.com/image.jpg"],
  "created_at": "2024-01-01T00:00:00Z"
}
```

**Headers (if WEBHOOK_SECRET is set):**
```
X-Webhook-Secret: your_secure_random_string_here
```

## Laravel Integration

Add this to your Laravel `.env`:

```env
DISCORD_BOT_WEBHOOK_URL=http://localhost:3000/webhook/listing
DISCORD_BOT_WEBHOOK_SECRET=your_secure_random_string_here
```

See the modified `ListingController.php` for the webhook implementation.

## Health Check

Check bot status:
```
GET http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "guilds": 1,
  "configuration": {
    "listing": {
      "general": "123456789012345678",
      "categories": {
        "wos_accounts": "123456789012345680",
        "kingshot_accounts": "Not configured"
      }
    },
    "dispute": {
      "general": "123456789012345679",
      "categories": {}
    }
  }
}
```

## Configuration

All configuration is done via environment variables in `.env`. No files or commands needed!

See `DISCORD_BOT_ENV_SETUP.md` for detailed configuration options.

## Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start src/index.js --name nxobot
pm2 save
pm2 startup
```

### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "src/index.js"]
```

### Environment Variables for Production

Make sure to set:
- `DISCORD_TOKEN` (required)
- `DISCORD_LISTING_CHANNEL_ID` (required)
- `DISCORD_DISPUTE_CHANNEL_ID` (optional)
- `PORT` (if different from 3000)
- `WEBHOOK_SECRET` (should match Laravel)
- `FRONTEND_URL` (your production frontend URL)
- Category-specific channels (optional)

## Troubleshooting

### Notifications not working
- Verify the webhook endpoint is accessible from your Laravel backend
- Check that `DISCORD_LISTING_CHANNEL_ID` is set in `.env`
- Verify `WEBHOOK_SECRET` matches in both bot and Laravel
- Check bot logs for errors (look for channel configuration warnings)
- Use `/health` endpoint to verify configuration

### Bot can't send messages
- Ensure the bot has "Send Messages" permission in the configured channel
- Check that the channel exists and the bot can access it

## License

ISC

