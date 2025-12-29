# Luxpower Telegram Alerts

A simple TypeScript service that monitors electricity status via the Luxpower API and sends Telegram notifications when electricity appears or disappears. Supports multiple subscribers with bot commands for real-time inverter information.

> **Note**: This project was generated using [Cursor AI](https://cursor.sh/). See [NOTICE.md](./NOTICE.md) for more information.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create a `.env` file** in the root directory:
   ```
   LUXPOWER_USERNAME=your_username
   LUXPOWER_PASSWORD=your_password
   LUXPOWER_API_ENDPOINT=https://eu.luxpowertek.com
   LUXPOWER_PLANT_ID=your_plant_id
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   POLL_INTERVAL=60000
   COMMAND_POLL_INTERVAL=5000
   ```

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

Build and run with Docker Compose:
```bash
docker compose up -d
```

Make sure to set `DOCKER_USER` in `docker-compose.yml` or as an environment variable.

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

- `POLL_INTERVAL`: Polling interval in milliseconds (default: 60000 = 60 seconds)
- `COMMAND_POLL_INTERVAL`: How often to check for bot commands (default: 1000 = 1 second)
- `LUXPOWER_API_ENDPOINT`: API endpoint URL (default: https://eu.luxpowertek.com)

Subscribers are automatically saved to `subscribers.json` file (excluded from git).
