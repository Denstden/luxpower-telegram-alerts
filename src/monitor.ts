import * as dotenv from 'dotenv';
import {LuxpowerClient} from './luxpower';
import {TelegramBot} from './telegram';
import {StatusPersistence} from './storage';
import {logger} from './utils';

dotenv.config();

const LUXPOWER_USERNAME = process.env.LUXPOWER_USERNAME;
const LUXPOWER_PASSWORD = process.env.LUXPOWER_PASSWORD;
const LUXPOWER_API_ENDPOINT = process.env.LUXPOWER_API_ENDPOINT || 'https://eu.luxpowertek.com';
const LUXPOWER_PLANT_ID = process.env.LUXPOWER_PLANT_ID || process.env.LUXPOWER_SERIAL_NUM;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30000', 10);
const COMMAND_POLL_INTERVAL = parseInt(process.env.COMMAND_POLL_INTERVAL || '1000', 10);
const ENABLE_HISTORY_CACHE = process.env.ENABLE_HISTORY_CACHE !== 'false';

if (!LUXPOWER_USERNAME || !LUXPOWER_PASSWORD) {
    logger.error('LUXPOWER_USERNAME and LUXPOWER_PASSWORD must be set in .env file');
    process.exit(1);
}

if (!LUXPOWER_PLANT_ID) {
    logger.error('LUXPOWER_PLANT_ID (or LUXPOWER_SERIAL_NUM) must be set in .env file');
    process.exit(1);
}

if (!TELEGRAM_BOT_TOKEN) {
    logger.error('TELEGRAM_BOT_TOKEN must be set in .env file');
    process.exit(1);
}

const luxpower = new LuxpowerClient(LUXPOWER_USERNAME!, LUXPOWER_PASSWORD!, LUXPOWER_API_ENDPOINT, ENABLE_HISTORY_CACHE);
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
                logger.info(
                    `Restored status: Electricity ${persistedStatus ? 'ON' : 'OFF'} (Grid Power: ${status.gridPower.toFixed(2)} W)`
                );
                logger.info(`Last status change: ${persistedChangeTime.toLocaleString()}`);

                if (persistedStatus !== status.hasElectricity) {
                    const now = new Date();
                    const duration = Math.floor((now.getTime() - persistedChangeTime.getTime()) / 1000);
                    logger.info(
                        `Status changed since last run. Persisted: ${persistedStatus ? 'ON' : 'OFF'}, Current: ${status.hasElectricity ? 'ON' : 'OFF'}, Grid Power: ${status.gridPower.toFixed(2)} W, Last change: ${persistedChangeTime.toISOString()}, Now: ${now.toISOString()}, Duration: ${duration}s`
                    );
                    logger.info(`Luxpower runtime data: ${JSON.stringify(status.rawData)}`);

                    if (status.hasElectricity) {
                        statusPersistence.updateStatus(true, now, 0, duration);
                        logger.info(`Decision: notify appeared (status changed since last run)`);
                        await telegram.notifyElectricityAppeared(status.gridPower, duration);
                    } else {
                        statusPersistence.updateStatus(false, now, duration, 0);
                        logger.info(`Decision: notify disappeared (status changed since last run)`);
                        await telegram.notifyElectricityDisappeared(duration);
                    }
                }
                previousStatus = status.hasElectricity;
            } else {
                previousStatus = status.hasElectricity;
                const now = new Date();
                statusPersistence.updateStatus(status.hasElectricity, now, 0, 0);
                logger.info(
                    `Initial status: Electricity ${status.hasElectricity ? 'ON' : 'OFF'} (Grid Power: ${status.gridPower.toFixed(2)} W)`
                );
            }
            return;
        }

        if (status.hasElectricity !== previousStatus) {
            const now = new Date();
            const persistedChangeTime = statusPersistence.getStatusChangeTime();
            const duration = persistedChangeTime ? Math.floor((now.getTime() - persistedChangeTime.getTime()) / 1000) : 0;
            const subscribers = telegram.getSubscriberCount();

            logger.info(
                `Status change detected. Previous: ${previousStatus ? 'ON' : 'OFF'}, Current: ${status.hasElectricity ? 'ON' : 'OFF'}, Grid Power: ${status.gridPower.toFixed(2)} W, Last change: ${persistedChangeTime ? persistedChangeTime.toISOString() : 'unknown'}, Now: ${now.toISOString()}, Duration: ${duration}s`
            );
            logger.info(`Luxpower runtime data: ${JSON.stringify(status.rawData)}`);

            if (status.hasElectricity) {
                statusPersistence.updateStatus(true, now, 0, duration);
                logger.info(`Electricity appeared! Sending notification to ${subscribers} subscriber(s)...`);
                await telegram.notifyElectricityAppeared(status.gridPower, duration);
            } else {
                statusPersistence.updateStatus(false, now, duration, 0);
                logger.info(`Electricity disappeared! Sending notification to ${subscribers} subscriber(s)...`);
                await telegram.notifyElectricityDisappeared(duration);
            }
            previousStatus = status.hasElectricity;
        }
    } catch (error: any) {
        logger.error(`Error in checkStatus: ${error.message}`);
    }
}

async function startMonitoring(): Promise<void> {
    logger.info('Starting electricity monitoring service...');
    logger.info(`Polling interval: ${POLL_INTERVAL / 1000} seconds`);
    logger.info(`Plant ID: ${LUXPOWER_PLANT_ID}`);
    logger.info(`Subscribers: ${telegram.getSubscriberCount()}`);
    logger.info(`History cache: ${ENABLE_HISTORY_CACHE ? 'enabled' : 'disabled'}`);

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
        logger.info('Shutting down monitoring service...');
        isRunning = false;
        clearInterval(intervalId);
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        logger.info('Shutting down monitoring service...');
        isRunning = false;
        clearInterval(intervalId);
        process.exit(0);
    });
}

startMonitoring().catch((error) => {
    logger.error(`Fatal error: ${error}`);
    process.exit(1);
});

