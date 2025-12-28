# Luxpower Telegram Alerts

A simple TypeScript service that monitors electricity status via the Luxpower API and sends Telegram notifications when electricity appears or disappears. Supports multiple subscribers with bot commands for real-time inverter information.

## Features

- ⚡ Automatic electricity status monitoring
- 📱 Telegram notifications for multiple subscribers
- 🤖 Interactive bot commands for inverter information
- 🔄 Real-time status updates
- 💾 Persistent subscriber management
- 🌍 Supports EU, US, and AU regions

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

**Test connection:**
```bash
npm run test
```

The service will:
- Poll the Luxpower API at the specified interval (default: 60 seconds)
- Detect when electricity appears (grid voltage > 180V and frequency 45-55Hz)
- Detect when electricity disappears
- Send Telegram notifications to all subscribed users on status changes
- Handle bot commands from users

## Bot Commands

Users can interact with the bot using these commands:

- `/start` - Subscribe to electricity notifications
- `/stop` - Unsubscribe from notifications
- `/status` - Check your subscription status
- `/info` or `/inverter` - Get current inverter status (grid, battery, solar, power flow)
- `/help` - Show all available commands

### Inverter Information

The `/info` command displays real-time data:
- **Grid Status**: Voltage, frequency, power flow (to/from grid)
- **Battery Status**: State of charge (%), voltage, power (charging/discharging)
- **Solar Input**: PV panel voltages and power for each input
- **Power Flow**: Inverter output, EPS backup, consumption
- **System Status**: Current system state and device time

All users who send `/start` will automatically receive notifications when electricity appears or disappears. No hardcoded chat IDs needed!

## Configuration

- `POLL_INTERVAL`: Polling interval in milliseconds (default: 60000 = 60 seconds)
- `COMMAND_POLL_INTERVAL`: How often to check for bot commands like /start, /stop (default: 5000 = 5 seconds)
- `LUXPOWER_API_ENDPOINT`: API endpoint URL (default: https://eu.luxpowertek.com)
  - Use `https://eu.luxpowertek.com` for European region
  - Use `https://us.luxpowertek.com` for US region
  - Use `https://au.luxpowertek.com` for Australian region

Subscribers are automatically saved to `subscribers.json` file (excluded from git).

## Project Structure

```
luxpower-telegram-alerts/
├── src/
│   ├── luxpower.ts      # Luxpower API client
│   ├── telegram.ts       # Telegram bot service
│   ├── subscribers.ts    # Subscriber management
│   ├── monitor.ts        # Main monitoring service
│   └── test-plant.ts     # Test utility
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

## Stopping the Service

Press `Ctrl+C` to gracefully stop the monitoring service.

To kill all running instances:
```bash
pkill -f "ts-node.*monitor"
```

## Troubleshooting

- **409 Conflict Error**: Usually means multiple instances are running. Kill all instances and start only one.
- **Login Failed**: Check your credentials and API endpoint in `.env` file.
- **No Notifications**: Make sure users have sent `/start` to subscribe to the bot.
