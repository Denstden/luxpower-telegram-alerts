import * as dotenv from 'dotenv';
import { LuxpowerClient } from './luxpower';
import { TelegramBot } from './telegram';

dotenv.config();

const LUXPOWER_USERNAME = process.env.LUXPOWER_USERNAME;
const LUXPOWER_PASSWORD = process.env.LUXPOWER_PASSWORD;
const LUXPOWER_API_ENDPOINT = process.env.LUXPOWER_API_ENDPOINT || 'https://eu.luxpowertek.com';
const LUXPOWER_PLANT_ID = process.env.LUXPOWER_PLANT_ID || process.env.LUXPOWER_SERIAL_NUM;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '60000', 10);
const COMMAND_POLL_INTERVAL = parseInt(process.env.COMMAND_POLL_INTERVAL || '5000', 10);

if (!LUXPOWER_USERNAME || !LUXPOWER_PASSWORD) {
  console.error('Error: LUXPOWER_USERNAME and LUXPOWER_PASSWORD must be set in .env file');
  process.exit(1);
}

if (!LUXPOWER_PLANT_ID) {
  console.error('Error: LUXPOWER_PLANT_ID (or LUXPOWER_SERIAL_NUM) must be set in .env file');
  process.exit(1);
}

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN must be set in .env file');
  process.exit(1);
}

const luxpower = new LuxpowerClient(LUXPOWER_USERNAME!, LUXPOWER_PASSWORD!, LUXPOWER_API_ENDPOINT);
const telegram = new TelegramBot(TELEGRAM_BOT_TOKEN!);
telegram.setLuxpowerClient(luxpower, LUXPOWER_PLANT_ID!);

let previousStatus: boolean | null = null;
let isRunning = true;

async function checkStatus(): Promise<void> {
  try {
    const status = await luxpower.checkElectricityStatus(LUXPOWER_PLANT_ID!);

    if (previousStatus === null) {
      console.log(
        `Initial status: Electricity ${status.hasElectricity ? 'ON' : 'OFF'} (Grid Power: ${status.gridPower.toFixed(2)} W)`
      );
      previousStatus = status.hasElectricity;
      return;
    }

    if (status.hasElectricity !== previousStatus) {
      if (status.hasElectricity) {
        console.log(`Electricity appeared! Sending notification to ${telegram.getSubscriberCount()} subscriber(s)...`);
        await telegram.notifyElectricityAppeared(status.gridPower);
      } else {
        console.log(`Electricity disappeared! Sending notification to ${telegram.getSubscriberCount()} subscriber(s)...`);
        await telegram.notifyElectricityDisappeared();
      }
      previousStatus = status.hasElectricity;
    } else {
      console.log(
        `Status unchanged: Electricity ${status.hasElectricity ? 'ON' : 'OFF'} (Grid Power: ${status.gridPower.toFixed(2)} W)`
      );
    }
  } catch (error: any) {
    console.error('Error in checkStatus:', error.message);
  }
}

async function startMonitoring(): Promise<void> {
  console.log('Starting electricity monitoring service...');
  console.log(`Polling interval: ${POLL_INTERVAL / 1000} seconds`);
  console.log(`Plant ID: ${LUXPOWER_PLANT_ID}`);
  console.log(`Subscribers: ${telegram.getSubscriberCount()}`);

  telegram.startCommandPolling(COMMAND_POLL_INTERVAL);

  await checkStatus();

  const intervalId = setInterval(async () => {
    if (!isRunning) {
      clearInterval(intervalId);
      return;
    }
    await checkStatus();
  }, POLL_INTERVAL);

  process.on('SIGINT', () => {
    console.log('\nShutting down monitoring service...');
    isRunning = false;
    clearInterval(intervalId);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down monitoring service...');
    isRunning = false;
    clearInterval(intervalId);
    process.exit(0);
  });
}

startMonitoring().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

