# Luxpower Telegram Alerts

A simple TypeScript service that monitors electricity status via the Luxpower API and sends Telegram notifications when electricity appears or disappears. Supports multiple subscribers with bot commands for real-time inverter information.

> **Note**: This project was generated using [Cursor AI](https://cursor.sh/). See [NOTICE.md](./NOTICE.md) for more information.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create a `.env` file** in the root directory:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and fill in your credentials. See `.env.example` for all available configuration options.

3. **Get your Plant ID:**
   - Log into https://eu.luxpowertek.com/WManage/web/monitor/inverter
   - The Plant ID (Serial Number) is shown in the station selection dropdown
   - It's a numeric value like `1234567890`

4. **Get Telegram Bot Token:**
   - Contact [@BotFather](https://t.me/BotFather) on Telegram
   - Create a new bot with `/newbot`
   - Copy the bot token

## Usage

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## Docker

### Using Docker Compose (Recommended)

Build and run with Docker Compose:
```bash
docker compose up -d
```

Make sure to set `DOCKER_USER` in `docker-compose.yml` or as an environment variable.

### Using Docker Run

You can also run the container directly with `docker run`:

```bash
docker run -d \
  --name luxpower-alerts \
  --restart unless-stopped \
  -v $(pwd)/.env:/app/.env:ro \
  -v $(pwd)/subscribers.json:/app/subscribers.json \
  -v $(pwd)/status.json:/app/status.json \
  -v /etc/localtime:/etc/localtime:ro \
  -v /etc/timezone:/etc/timezone:ro \
  -e NODE_ENV=production \
  yourusername/luxpower-telegram-alerts:latest
```

**Required Volumes:**
- `./.env:/app/.env:ro` - Configuration file with credentials (read-only for security)
- `./subscribers.json:/app/subscribers.json` - Subscriber data persistence (read-write)
- `./status.json:/app/status.json` - Status and duration tracking persistence (read-write)
- `/etc/localtime:/etc/localtime:ro` - System timezone for correct timestamps (read-only)
- `/etc/timezone:/etc/timezone:ro` - System timezone configuration (read-only)

**Note:** Make sure the `subscribers.json` and `status.json` files exist before starting the container. They will be created automatically if missing, but it's better to create them with proper permissions:
```bash
touch subscribers.json status.json
chmod 666 subscribers.json status.json
```

## Bot Commands

- `/start` - Subscribe to electricity notifications
- `/stop` - Unsubscribe from notifications
- `/status` - Check subscription status
- `/info` or `/inverter` - Get current inverter status (grid, battery, solar, power flow)
- `/menu` - Show main menu with buttons
- `/help` - Show all available commands

The `/info` command displays:
- **Grid Status**: Electricity status, voltage, consumption, GRID power
- **Battery Status**: State of charge (%), voltage, power (charging/discharging)
- **Solar Input**: PV panel voltages and power for each input
- **Power Flow**: Inverter output, EPS backup
- **System Status**: Current system state and device time

All users who send `/start` will automatically receive notifications when electricity appears or disappears.

## Configuration

- `POLL_INTERVAL`: Polling interval in milliseconds (default: 30000 = 30 seconds)
- `COMMAND_POLL_INTERVAL`: How often to check for bot commands (default: 1000 = 1 second)
- `LUXPOWER_API_ENDPOINT`: API endpoint URL (default: https://eu.luxpowertek.com)

Subscribers are automatically saved to `subscribers.json` file (excluded from git).
