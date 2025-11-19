# Discord Bot Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd NXOBot
npm install
```

### 2. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" → Name it (e.g., "NXOBot")
3. Go to **Bot** section → Click **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - Server Members Intent (if needed)
5. Copy the **Bot Token**
6. Go to **OAuth2** → **URL Generator**
   - Select scopes: `bot`, `applications.commands`
   - Select bot permissions:
     - Send Messages
     - Embed Links
     - Attach Files
   - Copy the generated URL and invite bot to your server(s)

### 3. Configure Environment

Create `.env` file in `NXOBot/` directory:

```env
DISCORD_TOKEN=your_discord_bot_token_here
PORT=3000
WEBHOOK_SECRET=your_secure_random_string_here
FRONTEND_URL=https://your-frontend-url.com
```

**Generate secure random string for WEBHOOK_SECRET:**
```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 4. Configure Laravel Backend

Add to your Laravel `.env`:

```env
DISCORD_BOT_WEBHOOK_URL=http://localhost:3000/webhook/listing
DISCORD_BOT_WEBHOOK_SECRET=your_secure_random_string_here
FRONTEND_URL=https://your-frontend-url.com
```

**Important:** 
- `WEBHOOK_SECRET` in bot `.env` must match `DISCORD_BOT_WEBHOOK_SECRET` in Laravel `.env`
- Update `DISCORD_BOT_WEBHOOK_URL` when deploying (use public URL/domain)
- Update `FRONTEND_URL` to your production frontend URL

### 5. Start the Bot

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### 6. Configure Discord Channel

In your Discord server, use slash commands:

```
/setchannel channel:#notifications
```

Check current channel:
```
/getchannel
```

Remove channel:
```
/removechannel
```

## Production Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start src/index.js --name nxobot
pm2 save
pm2 startup
```

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "src/index.js"]
```

Build and run:
```bash
docker build -t nxobot .
docker run -d --name nxobot --env-file .env -p 3000:3000 nxobot
```

### Environment Variables

Make sure to set:
- `DISCORD_TOKEN` - Your Discord bot token
- `PORT` - Port for webhook server (default: 3000)
- `WEBHOOK_SECRET` - Secret for webhook authentication (must match Laravel)
- `FRONTEND_URL` - Your production frontend URL (e.g., `https://nxoland.pages.dev`)

### Expose Webhook Endpoint

If bot is on a server, make sure:
- Port `3000` (or your PORT) is accessible
- Firewall allows incoming connections
- Use a reverse proxy (nginx, Caddy) for HTTPS
- Update Laravel `DISCORD_BOT_WEBHOOK_URL` to public URL

Example with nginx:
```nginx
server {
    listen 443 ssl;
    server_name bot.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then set in Laravel `.env`:
```env
DISCORD_BOT_WEBHOOK_URL=https://bot.yourdomain.com/webhook/listing
```

## Troubleshooting

### Bot doesn't respond to commands
- ✅ Bot is online (check console for "Bot is ready!")
- ✅ Wait up to 1 hour for global slash commands to propagate
- ✅ Or restart the bot to force command refresh
- ✅ Check bot has proper permissions in server

### Notifications not working
- ✅ Verify webhook URL is accessible from Laravel backend
- ✅ Check channel is configured: `/getchannel`
- ✅ Verify `WEBHOOK_SECRET` matches in both bot and Laravel
- ✅ Check bot logs for errors
- ✅ Test webhook manually:
  ```bash
  curl -X POST http://localhost:3000/webhook/listing \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Secret: your_secret_here" \
    -d '{
      "id": 1,
      "title": "Test Listing",
      "description": "Test description",
      "price": "99.99",
      "category": "Instagram",
      "images": [],
      "created_at": "2024-01-01T00:00:00Z"
    }'
  ```

### Bot can't send messages
- ✅ Bot has "Send Messages" permission in channel
- ✅ Channel exists and bot can access it
- ✅ Check channel ID in `config.json`

### Health Check

Check bot status:
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "guilds": 2,
  "configuredChannels": 2
}
```

## Testing

1. Start the bot: `npm start`
2. Configure a channel: `/setchannel channel:#test`
3. Create a test listing on your website
4. Check Discord channel for notification

## Support

For issues or questions, check:
- Bot logs in console
- Laravel logs: `storage/logs/laravel.log`
- Discord Developer Portal → Bot → Logs

