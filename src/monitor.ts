import * as dotenv from 'dotenv';
import { LuxpowerClient } from './luxpower';
import { TelegramBot } from './telegram';
import { StatusPersistence } from './status-persistence';

dotenv.config();

const LUXPOWER_USERNAME = process.env.LUXPOWER_USERNAME;
const LUXPOWER_PASSWORD = process.env.LUXPOWER_PASSWORD;
const LUXPOWER_API_ENDPOINT = process.env.LUXPOWER_API_ENDPOINT || 'https://eu.luxpowertek.com';
const LUXPOWER_PLANT_ID = process.env.LUXPOWER_PLANT_ID || process.env.LUXPOWER_SERIAL_NUM;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '60000', 10);
const COMMAND_POLL_INTERVAL = parseInt(process.env.COMMAND_POLL_INTERVAL || '1000', 10);

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
const statusPersistence = new StatusPersistence();

telegram.setLuxpowerClient(luxpower, LUXPOWER_PLANT_ID!);
telegram.setStatusTracker(() => {
  const now = new Date();
  const persistedChangeTime = statusPersistence.getStatusChangeTime();
  const currentDuration = persistedChangeTime ? Math.floor((now.getTime() - persistedChangeTime.getTime()) / 1000) : 0;
  const sessionStart = statusPersistence.getSessionStartTime();
  const sessionDuration = Math.floor((now.getTime() - sessionStart.getTime()) / 1000);
  const currentStatus = statusPersistence.getCurrentStatus();
  
  return {
    currentStatus,
    currentDuration,
    statusChangeTime: persistedChangeTime,
    totalOnTime: currentStatus === true ? statusPersistence.getTotalOnTime() + currentDuration : statusPersistence.getTotalOnTime(),
    totalOffTime: currentStatus === false ? statusPersistence.getTotalOffTime() + currentDuration : statusPersistence.getTotalOffTime(),
    sessionDuration
  };
});

let previousStatus: boolean | null = null;
let isRunning = true;

async function checkStatus(): Promise<void> {
  try {
    const status = await luxpower.checkElectricityStatus(LUXPOWER_PLANT_ID!);

    if (previousStatus === null) {
      const persistedStatus = statusPersistence.getCurrentStatus();
      const persistedChangeTime = statusPersistence.getStatusChangeTime();
      
      if (persistedStatus !== null && persistedChangeTime) {
        console.log(
          `Restored status: Electricity ${persistedStatus ? 'ON' : 'OFF'} (Grid Power: ${status.gridPower.toFixed(2)} W)`
        );
        console.log(`Last status change: ${persistedChangeTime.toLocaleString()}`);
        
        if (persistedStatus !== status.hasElectricity) {
          console.log(`Status changed since last run. Updating...`);
          const now = new Date();
          const duration = Math.floor((now.getTime() - persistedChangeTime.getTime()) / 1000);
          
          if (status.hasElectricity) {
            statusPersistence.updateStatus(true, now, 0, duration);
            await telegram.notifyElectricityAppeared(status.gridPower, duration);
          } else {
            statusPersistence.updateStatus(false, now, duration, 0);
            await telegram.notifyElectricityDisappeared(duration);
          }
        }
        previousStatus = status.hasElectricity;
      } else {
        previousStatus = status.hasElectricity;
        const now = new Date();
        statusPersistence.updateStatus(status.hasElectricity, now, 0, 0);
        console.log(
          `Initial status: Electricity ${status.hasElectricity ? 'ON' : 'OFF'} (Grid Power: ${status.gridPower.toFixed(2)} W)`
        );
      }
      return;
    }

    if (status.hasElectricity !== previousStatus) {
      const now = new Date();
      const persistedChangeTime = statusPersistence.getStatusChangeTime();
      const duration = persistedChangeTime ? Math.floor((now.getTime() - persistedChangeTime.getTime()) / 1000) : 0;
      
      if (status.hasElectricity) {
        statusPersistence.updateStatus(true, now, 0, duration);
        console.log(`Electricity appeared! Sending notification to ${telegram.getSubscriberCount()} subscriber(s)...`);
        await telegram.notifyElectricityAppeared(status.gridPower, duration);
      } else {
        statusPersistence.updateStatus(false, now, duration, 0);
        console.log(`Electricity disappeared! Sending notification to ${telegram.getSubscriberCount()} subscriber(s)...`);
        await telegram.notifyElectricityDisappeared(duration);
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

  await telegram.startCommandPolling(COMMAND_POLL_INTERVAL);

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

