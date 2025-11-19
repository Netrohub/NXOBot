# NXOBot - Discord Bot for NXOLand Marketplace

A Discord bot that automatically posts new listings from the NXOLand marketplace to configured Discord channels.

## Features

- ✅ **Automatic Notifications**: Receives webhook notifications from Laravel backend when new listings are created
- ✅ **Rich Embeds**: Beautiful Discord embeds with listing details, images, and links
- ✅ **Multi-Server Support**: Can be added to multiple Discord servers, each with its own notification channel
- ✅ **Slash Commands**: Easy configuration via Discord slash commands
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
   - `applications.commands`
9. Select bot permissions:
   - Send Messages
   - Embed Links
   - Attach Files (if you want image previews)
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
DISCORD_TOKEN=your_discord_bot_token_here
PORT=3000
WEBHOOK_SECRET=your_secure_random_string_here
FRONTEND_URL=https://your-frontend-url.com
```

**Important:**
- `DISCORD_TOKEN`: The bot token from Discord Developer Portal
- `WEBHOOK_SECRET`: Generate a random string (e.g., using `openssl rand -hex 32`) - this should match the value in your Laravel `.env`
- `FRONTEND_URL`: Your frontend URL where listings are hosted (e.g., `https://nxoland.pages.dev`)

### 4. Start the Bot

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Usage

### Setting Up Notification Channels

Once the bot is running and added to your Discord server:

1. **Set a notification channel:**
   ```
   /setchannel channel:#notifications
   ```

2. **Check current channel:**
   ```
   /getchannel
   ```

3. **Remove channel configuration:**
   ```
   /removechannel
   ```

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
  "guilds": 2,
  "configuredChannels": 2
}
```

## Configuration Storage

Channel configurations are stored in `config.json` in the bot directory:

```json
{
  "guild_id_1": {
    "channelId": "channel_id_1"
  },
  "guild_id_2": {
    "channelId": "channel_id_2"
  }
}
```

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
- `DISCORD_TOKEN`
- `PORT` (if different from 3000)
- `WEBHOOK_SECRET` (should match Laravel)
- `FRONTEND_URL` (your production frontend URL)

## Troubleshooting

### Bot doesn't respond to commands
- Make sure the bot is online (check console for "Bot is ready!")
- Wait up to 1 hour for global slash commands to propagate, or restart the bot
- Check that the bot has proper permissions in your server

### Notifications not working
- Verify the webhook endpoint is accessible from your Laravel backend
- Check that a channel is configured using `/getchannel`
- Verify `WEBHOOK_SECRET` matches in both bot and Laravel
- Check bot logs for errors

### Bot can't send messages
- Ensure the bot has "Send Messages" permission in the configured channel
- Check that the channel exists and the bot can access it

## License

ISC

