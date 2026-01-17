import axios from 'axios';
import {LuxpowerClient} from '../../luxpower';
import {SubscribersManager, UserPreferencesManager} from '../../storage';
import {ChartGenerator} from '../../charts';
import {
    DEFAULT_GROUP_LANGUAGE,
    DEFAULT_PRIVATE_LANGUAGE,
    formatDateTime,
    getTranslations,
    Language,
    logger,
    SUPPORTED_LANGUAGES
} from '../../utils';
import {MessageFormatter} from '../messages/formatters';
import {KeyboardBuilder} from '../messages/keyboards';
import FormData from 'form-data';
import * as packageJson from '../../../package.json';

interface StatusTracker {
    currentStatus: boolean | null;
    currentDuration: number;
    statusChangeTime: Date | null;
    totalOnTime: number;
    totalOffTime: number;
    sessionDuration: number;
}

export class CommandHandlers {
    private luxpower: LuxpowerClient | null;
    private plantId: string | null;
    private subscribers: SubscribersManager;
    private preferences: UserPreferencesManager;
    private statusTracker: (() => StatusTracker) | null;
    private chartGenerator: ChartGenerator;
    private formatter: MessageFormatter;
    private keyboardBuilder: KeyboardBuilder;
    private apiUrl: string;

    constructor(
        apiUrl: string,
        subscribers: SubscribersManager,
        preferences: UserPreferencesManager
    ) {
        this.apiUrl = apiUrl;
        this.luxpower = null;
        this.plantId = null;
        this.subscribers = subscribers;
        this.preferences = preferences;
        this.statusTracker = null;
        this.chartGenerator = new ChartGenerator();
        this.formatter = new MessageFormatter();
        this.keyboardBuilder = new KeyboardBuilder();
    }

    setLuxpowerClient(luxpower: LuxpowerClient, plantId: string): void {
        this.luxpower = luxpower;
        this.plantId = plantId;
    }

    setStatusTracker(tracker: () => StatusTracker): void {
        this.statusTracker = tracker;
    }

    private isGroupChat(chatId: number | string): boolean {
        const id = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        return id < 0;
    }

    private getLanguage(chatId: string): Language {
        const chatIdNum = parseInt(chatId, 10);
        const isGroup = this.isGroupChat(chatIdNum);
        return this.preferences.getLanguage(chatId, isGroup ? DEFAULT_GROUP_LANGUAGE : DEFAULT_PRIVATE_LANGUAGE);
    }

    async handleInfo(
        chatId: string,
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>
    ): Promise<void> {
        const lang = this.getLanguage(chatId);
        const t = getTranslations(lang);

        if (!this.luxpower || !this.plantId) {
            await sendMessage(chatId, t.errors.inverterNotAvailable);
            return;
        }

        try {
            const status = await this.luxpower.checkElectricityStatus(this.plantId);
            const stats = this.statusTracker ? this.statusTracker() : null;
            const message = this.formatter.formatInverterInfo(status.rawData, stats, lang);
            const keyboard = this.keyboardBuilder.getInverterInfoKeyboard(lang);
            await sendMessage(chatId, message, keyboard);
        } catch (error: any) {
            await sendMessage(chatId, `${t.errors.errorFetching} ${error.message}`);
            logger.error(`Error sending inverter info: ${error.message}`);
        }
    }

    async handleStatus(
        chatId: string,
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>
    ): Promise<void> {
        const lang = this.getLanguage(chatId);
        const stats = this.statusTracker ? this.statusTracker() : null;
        const message = this.formatter.formatStatusInfo(stats, lang);
        const keyboard = this.keyboardBuilder.getMainMenu(chatId, this.subscribers.has(chatId), lang);
        await sendMessage(chatId, message, keyboard);
    }

    async handleSubscribe(
        chatId: string,
        userName: string,
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>
    ): Promise<void> {
        const lang = this.getLanguage(chatId);
        const t = getTranslations(lang);
        const chatIdNum = parseInt(chatId, 10);
        const isGroup = this.isGroupChat(chatIdNum);

        try {
            const wasAlreadySubscribed = this.subscribers.has(chatId);
            logger.info(`Subscribe attempt for ${chatId} (was already subscribed: ${wasAlreadySubscribed})`);

            let added = false;
            if (wasAlreadySubscribed) {
                added = false;
            } else {
                added = this.subscribers.add(chatId);
                if (!added) {
                    logger.warn(`ChatId ${chatId} add() returned false but was not subscribed. Force adding...`);
                    this.subscribers.forceAdd(chatId);
                    added = true;
                }
            }

            logger.info(`Subscribe result for ${chatId}: added=${added}, current count=${this.subscribers.count()}`);

            if (added) {
                if (isGroup) {
                    await sendMessage(
                        chatId,
                        `${t.subscribe.groupSubscribed}\n\n${t.subscribe.groupJoke}`
                    );
                } else {
                    await sendMessage(
                        chatId,
                        `${t.subscribe.subscribed}\n\n${t.subscribe.willReceive}\n\n${t.subscribe.useButtons}`,
                        this.keyboardBuilder.getMainMenu(chatId, true, lang)
                    );
                }
                logger.info(`${isGroup ? 'Group' : 'User'} ${userName} (${chatId}) subscribed. Total subscribers: ${this.subscribers.count()}`);

                const enableTestNotifications = process.env.ENABLE_TEST_NOTIFICATIONS === 'true';
                if (enableTestNotifications) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const testGridPower = 2500.0;
                        const testOffDuration = 3600;
                        const testOnDuration = 7200;

                        let appearedMessage: string;
                        let appearedKeyboard: any = undefined;

                        if (isGroup) {
                            appearedMessage = `${t.group.electricityAppeared}\n${t.notifications.wasOffFor} ${this.formatter.formatDuration(testOffDuration, lang)}`;
                        } else {
                            appearedMessage = `${t.notifications.electricityAppeared}\n\n${t.notifications.gridPower} ${testGridPower.toFixed(2)} W\n${t.notifications.wasOffFor} ${this.formatter.formatDuration(testOffDuration, lang)}\n${t.notifications.time} ${formatDateTime(new Date(), lang)}\n\n${t.notifications.useInfo}`;
                            appearedKeyboard = this.keyboardBuilder.getNotificationKeyboard(lang);
                        }

                        await sendMessage(chatId, appearedMessage, appearedKeyboard).catch(error => {
                            logger.warn(`Failed to send test appeared notification to ${chatId}: ${error.message}`);
                        });

                        await new Promise(resolve => setTimeout(resolve, 2000));

                        let disappearedMessage: string;
                        let disappearedKeyboard: any = undefined;

                        if (isGroup) {
                            disappearedMessage = `${t.group.electricityDisappeared}\n${t.notifications.wasOnFor} ${this.formatter.formatDuration(testOnDuration, lang)}`;
                        } else {
                            disappearedMessage = `${t.notifications.electricityDisappeared}\n\n${t.notifications.wasOnFor} ${this.formatter.formatDuration(testOnDuration, lang)}\n\n${t.notifications.time} ${formatDateTime(new Date(), lang)}\n\n${t.notifications.useInfo}`;
                            disappearedKeyboard = this.keyboardBuilder.getNotificationKeyboard(lang);
                        }

                        await sendMessage(chatId, disappearedMessage, disappearedKeyboard).catch(error => {
                            logger.warn(`Failed to send test disappeared notification to ${chatId}: ${error.message}`);
                        });
                    } catch (testError: any) {
                        logger.warn(`Error sending test notifications to ${chatId}: ${testError.message}`);
                    }
                }
            } else {
                if (isGroup) {
                    await sendMessage(
                        chatId,
                        `${t.subscribe.groupAlreadySubscribed}\n\n${t.subscribe.groupJoke}`
                    );
                } else {
                    await sendMessage(
                        chatId,
                        `${t.subscribe.alreadySubscribed}`,
                        this.keyboardBuilder.getMainMenu(chatId, true, lang)
                    );
                }
            }
        } catch (error: any) {
            logger.error(`Error in handleSubscribe for ${chatId}: ${error.message}`);
            await sendMessage(chatId, `❌ Error: ${error.message}`).catch(() => {
            });
        }
    }

    async handleUnsubscribe(
        chatId: string,
        userName: string,
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>
    ): Promise<void> {
        const lang = this.getLanguage(chatId);
        const t = getTranslations(lang);
        const chatIdNum = parseInt(chatId, 10);
        const isGroup = this.isGroupChat(chatIdNum);
        const removed = this.subscribers.remove(chatId);

        if (removed) {
            if (isGroup) {
                await sendMessage(
                    chatId,
                    t.subscribe.groupUnsubscribed
                );
            } else {
                await sendMessage(
                    chatId,
                    `${t.subscribe.unsubscribed}\n\n${t.subscribe.noLongerReceive}\n\n${t.subscribe.useStart}`
                );
            }
            logger.info(`${isGroup ? 'Group' : 'User'} ${userName} (${chatId}) unsubscribed. Total subscribers: ${this.subscribers.count()}`);
        } else {
            await sendMessage(chatId, t.subscribe.notSubscribed);
        }
    }

    async handleHelp(
        chatId: string,
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>
    ): Promise<void> {
        const lang = this.getLanguage(chatId);
        const version = packageJson.version || 'unknown';
        const message = this.formatter.formatHelp(version, lang);
        const keyboard = this.keyboardBuilder.getMainMenu(chatId, this.subscribers.has(chatId), lang);
        await sendMessage(chatId, message, keyboard);
    }

    async handleMenu(
        chatId: string,
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>
    ): Promise<void> {
        const lang = this.getLanguage(chatId);
        const t = getTranslations(lang);
        const version = packageJson.version || 'unknown';
        const message = `${t.menu.mainMenu}\n\n${t.menu.selectOption}\n\n📦 <b>${t.menu.version}</b> ${version}`;
        const keyboard = this.keyboardBuilder.getMainMenu(chatId, this.subscribers.has(chatId), lang);
        await sendMessage(chatId, message, keyboard);
    }

    async handleLanguage(
        chatId: string,
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>
    ): Promise<void> {
        const lang = this.getLanguage(chatId);
        const t = getTranslations(lang);
        const chatIdNum = parseInt(chatId, 10);
        const isGroup = this.isGroupChat(chatIdNum);
        const currentLang = this.preferences.getLanguage(chatId, isGroup ? DEFAULT_GROUP_LANGUAGE : DEFAULT_PRIVATE_LANGUAGE);
        const keyboard = this.keyboardBuilder.getLanguageKeyboard(currentLang, lang);
        await sendMessage(chatId, `${t.language.current} ${currentLang === DEFAULT_GROUP_LANGUAGE ? '🇺🇦 Українська' : '🇬🇧 English'}\n\n${t.language.select}`, keyboard);
    }

    async handleLanguageChange(
        chatId: string,
        language: Language,
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>
    ): Promise<void> {
        if (SUPPORTED_LANGUAGES.includes(language)) {
            this.preferences.setLanguage(chatId, language);
            const lang = this.getLanguage(chatId);
            const t = getTranslations(lang);
            await sendMessage(chatId, `${t.language.changed} ${language === DEFAULT_GROUP_LANGUAGE ? '🇺🇦 Українська' : '🇬🇧 English'}`, this.keyboardBuilder.getMainMenu(chatId, this.subscribers.has(chatId), lang));
        }
    }

    async handleChart(
        chatId: string,
        hours: number,
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>
    ): Promise<void> {
        const lang = this.getLanguage(chatId);
        const t = getTranslations(lang);

        if (!this.luxpower || !this.plantId) {
            await sendMessage(chatId, t.charts.notAvailable);
            return;
        }

        try {
            let periodLabel = '';
            if (hours === 24) {
                periodLabel = t.charts.period1Day;
            } else if (hours === 168) {
                periodLabel = t.charts.period1Week;
            } else if (hours === 720) {
                periodLabel = t.charts.period1Month;
            } else {
                periodLabel = `${hours} ${t.charts.periodHours}`;
            }

            await sendMessage(chatId, `${t.charts.generating} ${periodLabel}...`);

            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));

            const historyData = await this.luxpower.getHistoryData(this.plantId, startDate, endDate);

            if (historyData.length === 0) {
                await sendMessage(chatId, `${t.charts.noData} ${periodLabel}.`);
                return;
            }

            const chartBuffer = await this.chartGenerator.generateTimelineChart(historyData, hours, lang);

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('photo', chartBuffer, {
                filename: 'chart.png',
                contentType: 'image/png'
            });
            formData.append('caption', `${t.charts.title}\n\n${periodLabel}\n\n${t.charts.greenOn} | ${t.charts.redOff}`);
            formData.append('parse_mode', 'HTML');

            await axios.post(`${this.apiUrl}/sendPhoto`, formData, {
                headers: formData.getHeaders()
            });

            const keyboard = this.keyboardBuilder.getChartKeyboard(hours, lang);
            await sendMessage(chatId, t.charts.selectTimeRange, keyboard);
        } catch (error: any) {
            logger.error(`Error sending chart: ${error.message}`);
            await sendMessage(chatId, `${t.charts.error} ${error.message}`);
        }
    }

    async handleGroupReadonly(
        chatId: string,
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>
    ): Promise<void> {
        const lang = this.getLanguage(chatId);
        const t = getTranslations(lang);
        await sendMessage(chatId, t.group.readonlyMessage);
    }
}
