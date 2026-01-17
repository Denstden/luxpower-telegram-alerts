import {SubscribersManager, UserPreferencesManager} from '../storage';
import {formatDateTime, getTranslations, Language} from '../utils';
import {KeyboardBuilder} from './messages/keyboards';
import {MessageFormatter} from './messages/formatters';

export class NotificationService {
    private subscribers: SubscribersManager;
    private preferences: UserPreferencesManager;
    private keyboardBuilder: KeyboardBuilder;
    private formatter: MessageFormatter;

    constructor(
        subscribers: SubscribersManager,
        preferences: UserPreferencesManager
    ) {
        this.subscribers = subscribers;
        this.preferences = preferences;
        this.keyboardBuilder = new KeyboardBuilder();
        this.formatter = new MessageFormatter();
    }

    private isGroupChat(chatId: number | string): boolean {
        const id = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        return id < 0;
    }

    private getLanguage(chatId: string): Language {
        const chatIdNum = parseInt(chatId, 10);
        const isGroup = this.isGroupChat(chatIdNum);
        return this.preferences.getLanguage(chatId, isGroup ? 'uk' : 'en');
    }

    async notifyElectricityAppeared(
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>,
        gridPower: number,
        previousOffDuration: number = 0
    ): Promise<void> {
        const chatIds = this.subscribers.getAll();
        for (const chatId of chatIds) {
            const chatIdNum = parseInt(chatId, 10);
            const isGroup = this.isGroupChat(chatIdNum);
            const lang = this.getLanguage(chatId);
            const t = getTranslations(lang);

            let message: string;
            let keyboard: any = undefined;

            if (isGroup) {
                const offDurationText = previousOffDuration > 0 ? `\n${t.notifications.wasOffFor} ${this.formatter.formatDuration(previousOffDuration)}` : '';
                message = `${t.group.electricityAppeared}${offDurationText}\n\n${t.group.readonlyMessage.split('\n\n')[1]}`;
            } else {
                const offDurationText = previousOffDuration > 0 ? `${t.notifications.wasOffFor} ${this.formatter.formatDuration(previousOffDuration)}` : '';
                message = `${t.notifications.electricityAppeared}\n\n${t.notifications.gridPower} ${gridPower.toFixed(2)} W${offDurationText}\n${t.notifications.time} ${formatDateTime(new Date(), lang)}\n\n${t.notifications.useInfo}`;
                keyboard = this.keyboardBuilder.getNotificationKeyboard(lang);
            }

            await sendMessage(chatId, message, keyboard).catch(() => {
            });
        }
    }

    async notifyElectricityDisappeared(
        sendMessage: (chatId: string, text: string, keyboard?: any) => Promise<any>,
        previousOnDuration: number = 0
    ): Promise<void> {
        const chatIds = this.subscribers.getAll();
        for (const chatId of chatIds) {
            const chatIdNum = parseInt(chatId, 10);
            const isGroup = this.isGroupChat(chatIdNum);
            const lang = this.getLanguage(chatId);
            const t = getTranslations(lang);

            let message: string;
            let keyboard: any = undefined;

            if (isGroup) {
                const onDurationText = previousOnDuration > 0 ? `\n${t.notifications.wasOnFor} ${this.formatter.formatDuration(previousOnDuration)}` : '';
                message = `${t.group.electricityDisappeared}${onDurationText}\n\n${t.group.readonlyMessage.split('\n\n')[1]}`;
            } else {
                const onDurationText = previousOnDuration > 0 ? `${t.notifications.wasOnFor} ${this.formatter.formatDuration(previousOnDuration)}` : '';
                message = `${t.notifications.electricityDisappeared}${onDurationText}\n\n${t.notifications.time} ${formatDateTime(new Date(), lang)}\n\n${t.notifications.useInfo}`;
                keyboard = this.keyboardBuilder.getNotificationKeyboard(lang);
            }

            await sendMessage(chatId, message, keyboard).catch(() => {
            });
        }
    }
}
