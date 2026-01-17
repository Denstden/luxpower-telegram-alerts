import axios, {AxiosResponse} from 'axios';
import {SubscribersManager, UserPreferencesManager} from '../storage';
import {LuxpowerClient} from '../luxpower';
import {logger} from '../utils';
import {CommandHandlers} from './commands/handlers';
import {NotificationService} from './notifications';

interface TelegramResponse {
    ok: boolean;
    result?: any;
    error_code?: number;
    description?: string;
}

interface TelegramUpdate {
    update_id: number;
    message?: {
        chat: {
            id: number;
            type?: string;
            first_name?: string;
            username?: string;
        };
        text?: string;
    };
    callback_query?: {
        id: string;
        from: {
            id: number;
            first_name?: string;
            username?: string;
        };
        message?: {
            chat: {
                id: number;
                type?: string;
            };
        };
        data?: string;
    };
}

interface StatusTracker {
    currentStatus: boolean | null;
    currentDuration: number;
    statusChangeTime: Date | null;
    totalOnTime: number;
    totalOffTime: number;
    sessionDuration: number;
}

export class TelegramBot {
    private botToken: string;
    private apiUrl: string;
    private subscribers: SubscribersManager;
    private preferences: UserPreferencesManager;
    private lastUpdateId: number = 0;
    private luxpower: LuxpowerClient | null = null;
    private plantId: string | null = null;
    private isPolling: boolean = false;
    private pollingIntervalId: NodeJS.Timeout | null = null;
    private statusTracker: (() => StatusTracker) | null = null;
    private commandHandlers: CommandHandlers;
    private notificationService: NotificationService;

    constructor(botToken: string) {
        this.botToken = botToken;
        this.apiUrl = `https://api.telegram.org/bot${botToken}`;
        this.subscribers = new SubscribersManager();
        this.preferences = new UserPreferencesManager();
        this.commandHandlers = new CommandHandlers(this.apiUrl, this.subscribers, this.preferences);
        this.notificationService = new NotificationService(this.subscribers, this.preferences);
    }

    private isGroupChat(chatId: number | string): boolean {
        const id = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        return id < 0;
    }

    private async deleteWebhook(): Promise<void> {
        try {
            await axios.post(`${this.apiUrl}/deleteWebhook`, {drop_pending_updates: true});
            logger.debug('Webhook deleted (if any existed)');
        } catch (error: any) {
            logger.debug(`No webhook to delete or error deleting webhook: ${error.message}`);
        }
    }

    setLuxpowerClient(luxpower: LuxpowerClient, plantId: string): void {
        this.luxpower = luxpower;
        this.plantId = plantId;
        this.commandHandlers.setLuxpowerClient(luxpower, plantId);
    }

    setStatusTracker(tracker: () => StatusTracker): void {
        this.statusTracker = tracker;
        this.commandHandlers.setStatusTracker(tracker);
    }

    async sendMessage(chatId: string, text: string, replyMarkup?: any): Promise<TelegramResponse> {
        try {
            const response: AxiosResponse<TelegramResponse> = await axios.post(
                `${this.apiUrl}/sendMessage`,
                {
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                }
            );

            return response.data;
        } catch (error: any) {
            logger.error(`Telegram send message error to ${chatId}: ${error.message}`);
            if (error.response) {
                logger.debug(`Response data: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    async notifyElectricityAppeared(gridPower: number, previousOffDuration: number = 0): Promise<void> {
        await this.notificationService.notifyElectricityAppeared(
            (chatId, text, keyboard) => this.sendMessage(chatId, text, keyboard),
            gridPower,
            previousOffDuration
        );
    }

    async notifyElectricityDisappeared(previousOnDuration: number = 0): Promise<void> {
        await this.notificationService.notifyElectricityDisappeared(
            (chatId, text, keyboard) => this.sendMessage(chatId, text, keyboard),
            previousOnDuration
        );
    }

    async handleUpdates(): Promise<void> {
        if (this.isPolling) {
            return;
        }

        this.isPolling = true;
        try {
            const response: AxiosResponse<{ ok: boolean; result: TelegramUpdate[] }> = await axios.get(
                `${this.apiUrl}/getUpdates`,
                {
                    params: {
                        offset: this.lastUpdateId + 1,
                        timeout: 5,
                        allowed_updates: ['message', 'callback_query']
                    },
                    timeout: 6000
                }
            );

            if (response.data.ok && response.data.result) {
                for (const update of response.data.result) {
                    if (update.update_id >= this.lastUpdateId) {
                        this.lastUpdateId = update.update_id;
                    }

                    if (update.callback_query) {
                        const chatId = update.callback_query.message?.chat.id.toString() || update.callback_query.from.id.toString();
                        const chatIdNum = update.callback_query.message?.chat.id || update.callback_query.from.id;
                        const data = update.callback_query.data;
                        const userName = update.callback_query.from.first_name || update.callback_query.from.username || 'User';

                        try {
                            await axios.post(`${this.apiUrl}/answerCallbackQuery`, {
                                callback_query_id: update.callback_query.id
                            });

                            if (this.isGroupChat(chatIdNum)) {
                                await this.commandHandlers.handleGroupReadonly(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                                continue;
                            }

                            if (data === 'info') {
                                await this.commandHandlers.handleInfo(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (data === 'status') {
                                await this.commandHandlers.handleStatus(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (data === 'subscribe') {
                                await this.commandHandlers.handleSubscribe(chatId, userName, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (data === 'unsubscribe') {
                                await this.commandHandlers.handleUnsubscribe(chatId, userName, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (data === 'help') {
                                await this.commandHandlers.handleHelp(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (data === 'menu') {
                                await this.commandHandlers.handleMenu(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (data === 'language') {
                                await this.commandHandlers.handleLanguage(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (data?.startsWith('lang_')) {
                                const lang = data.replace('lang_', '') as 'uk' | 'en';
                                await this.commandHandlers.handleLanguageChange(chatId, lang, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (data?.startsWith('chart_')) {
                                const hours = parseInt(data.replace('chart_', ''), 10);
                                await this.commandHandlers.handleChart(chatId, hours, (id, text, kb) => this.sendMessage(id, text, kb));
                            }
                        } catch (cmdError: any) {
                            logger.warn(`Error processing callback from ${chatId}: ${cmdError.message}`);
                        }
                    } else if (update.message?.text && update.message?.chat) {
                        const chatId = update.message.chat.id.toString();
                        const chatIdNum = update.message.chat.id;
                        const text = update.message.text.trim().toLowerCase();
                        const userName = update.message.chat.first_name || update.message.chat.username || 'User';

                        try {
                            if (text === '/start') {
                                await this.commandHandlers.handleSubscribe(chatId, userName, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (text === '/stop') {
                                await this.commandHandlers.handleUnsubscribe(chatId, userName, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (this.isGroupChat(chatIdNum)) {
                                if (text.startsWith('/')) {
                                    await this.commandHandlers.handleGroupReadonly(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                                }

                            } else if (text === '/status') {
                                await this.commandHandlers.handleStatus(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (text === '/info' || text === '/inverter') {
                                await this.commandHandlers.handleInfo(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (text === '/help') {
                                await this.commandHandlers.handleHelp(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (text === '/menu') {
                                await this.commandHandlers.handleMenu(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (text === '/language' || text === '/lang') {
                                await this.commandHandlers.handleLanguage(chatId, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (text === '/chart' || text === '/history') {
                                await this.commandHandlers.handleChart(chatId, 24, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (text === '/chart_day' || text === '/chart_1d') {
                                await this.commandHandlers.handleChart(chatId, 24, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (text === '/chart_week' || text === '/chart_1w') {
                                await this.commandHandlers.handleChart(chatId, 168, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (text === '/chart_month' || text === '/chart_1m') {
                                await this.commandHandlers.handleChart(chatId, 720, (id, text, kb) => this.sendMessage(id, text, kb));
                            } else if (text.startsWith('/chart_')) {
                                const hoursMatch = text.match(/\/chart_(\d+)/);
                                if (hoursMatch) {
                                    const hours = parseInt(hoursMatch[1], 10);
                                    await this.commandHandlers.handleChart(chatId, hours, (id, text, kb) => this.sendMessage(id, text, kb));
                                } else {
                                    await this.commandHandlers.handleChart(chatId, 24, (id, text, kb) => this.sendMessage(id, text, kb));
                                }
                            }
                        } catch (cmdError: any) {
                            logger.warn(`Error processing command from ${chatId}: ${cmdError.message}`);
                        }
                    }
                }
            }
        } catch (error: any) {
            if (error.response?.status === 409) {
                const errorDescription = error.response?.data?.description || error.message;
                logger.warn(`Telegram API conflict (409): ${errorDescription}`);
                logger.warn('This usually means:');
                logger.warn('  1. A webhook is set for this bot (use deleteWebhook API to remove it)');
                logger.warn('  2. Another instance is polling getUpdates');
                logger.warn('  3. The bot token is being used elsewhere');
                return;
            }
            if (error.response?.status === 429) {
                logger.debug('Telegram API rate limit (429) - waiting before next poll...');
                return;
            }
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return;
            }
            if (error.code !== 'ECONNABORTED') {
                logger.error(`Error handling Telegram updates: ${error.message}`);
                if (error.response) {
                    logger.debug(`Response status: ${error.response.status}`);
                    logger.debug(`Response data: ${JSON.stringify(error.response.data)}`);
                }
            }
        } finally {
            this.isPolling = false;
        }
    }

    async startCommandPolling(intervalMs: number = 5000): Promise<void> {
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
        }

        await this.deleteWebhook();
        await new Promise(resolve => setTimeout(resolve, 1000));

        this.pollingIntervalId = setInterval(() => {
            if (!this.isPolling) {
                this.handleUpdates().catch(error => {
                    logger.error(`Error in command polling: ${error.message}`);
                });
            }
        }, intervalMs);
        logger.info('Telegram command polling started');
    }

    getSubscriberCount(): number {
        return this.subscribers.count();
    }
}
