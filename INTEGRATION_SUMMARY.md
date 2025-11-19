# Discord Bot Integration Summary

## Overview

This Discord bot automatically posts new listings from your NXOLand marketplace to configured Discord channels when they are created on your website.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Laravel   │  POST   │  Discord Bot │  POST   │   Discord   │
│   Backend   │────────>│  (Node.js)   │────────>│   Channel   │
│             │ Webhook │              │ Embed   │             │
└─────────────┘         └──────────────┘         └─────────────┘
     │                        │                          │
     │                        │                          │
     ▼                        ▼                          ▼
  Creates               Receives listing           Displays
  listing               notification               rich embed
```

## Flow

1. **User creates listing** on your website
2. **Laravel backend** saves listing to database
3. **DiscordBotService** sends HTTP POST request to bot webhook endpoint
4. **Discord bot** receives webhook and validates request
5. **Bot sends rich embed** to all configured Discord channels

## Components

### 1. Discord Bot (`NXOBot/`)

**Location:** `NXOBot/src/index.js`

**Features:**
- Slash commands for channel configuration (`/setchannel`, `/getchannel`, `/removechannel`)
- Webhook endpoint at `/webhook/listing` to receive notifications
- Rich embed messages with listing details
- Multi-server support (each server can have its own channel)
- Channel configuration stored in `config.json`

**Required Environment Variables:**
- `DISCORD_TOKEN` - Bot token from Discord Developer Portal
- `PORT` - Port for webhook server (default: 3000)
- `WEBHOOK_SECRET` - Secret for webhook authentication (must match Laravel)
- `FRONTEND_URL` - Frontend URL for listing links

### 2. Laravel Integration

**Files Modified:**
- `backend/app/Services/DiscordBotService.php` - Service to send webhooks
- `backend/app/Http/Controllers/ListingController.php` - Calls service on listing creation
- `backend/config/services.php` - Configuration for Discord bot

**Required Environment Variables:**
- `DISCORD_BOT_WEBHOOK_URL` - URL of bot webhook endpoint (e.g., `http://localhost:3000/webhook/listing`)
- `DISCORD_BOT_WEBHOOK_SECRET` - Secret for webhook authentication (must match bot)
- `FRONTEND_URL` - Frontend URL for listing links

### 3. Configuration Storage

**Bot Configuration:** `NXOBot/config.json`
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

## Setup Steps

1. **Create Discord Bot** (see `DISCORD_BOT_SETUP.md`)
2. **Install bot dependencies:** `cd NXOBot && npm install`
3. **Configure bot `.env`** with Discord token and settings
4. **Configure Laravel `.env`** with webhook URL and secret
5. **Start bot:** `npm start`
6. **Invite bot to Discord server**
7. **Configure channel:** `/setchannel channel:#notifications`
8. **Create test listing** on website to verify

## Webhook Payload

**Request (Laravel → Bot):**
```json
POST /webhook/listing
Headers:
  Content-Type: application/json
  X-Webhook-Secret: your_secure_random_string_here

Body:
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

**Response (Bot → Laravel):**
```json
{
  "success": true,
  "sentTo": 2,
  "errors": []
}
```

## Security

- **Webhook Secret Authentication:** Optional but recommended
- **Token Security:** Discord bot token stored in `.env` (never commit)
- **Error Handling:** Bot errors don't affect listing creation (non-blocking)
- **Validation:** Bot validates webhook payload before processing

## Error Handling

- Laravel logs webhook failures but doesn't fail listing creation
- Bot logs errors to console
- Missing channel configurations are skipped (not errors)
- Invalid webhook secrets return 401 Unauthorized

## Testing

1. **Test webhook manually:**
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

2. **Check bot health:**
```bash
curl http://localhost:3000/health
```

3. **Create test listing** on website and check Discord channel

## Troubleshooting

See `DISCORD_BOT_SETUP.md` for detailed troubleshooting steps.

## Deployment

- **Bot:** Deploy to server (VPS, Render, Railway, etc.) or run locally
- **Webhook URL:** Must be publicly accessible for production
- **HTTPS:** Recommended for production (use reverse proxy)
- **Environment Variables:** Set in deployment platform

## Future Enhancements

Possible improvements:
- Support for multiple channels per server
- Filter by category or price range
- Custom embed formatting per server
- Rate limiting for webhooks
- Retry mechanism for failed notifications
- Analytics dashboard

