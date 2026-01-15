import axios, { AxiosResponse } from 'axios';
import { SubscribersManager } from './subscribers';
import { LuxpowerClient } from './luxpower';
import { ChartGenerator } from './chart-generator';
import * as packageJson from '../package.json';
import FormData from 'form-data';
import { logger } from './logger';
import { getTranslations, Language } from './translations';
import { UserPreferencesManager } from './user-preferences';

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
  private chartGenerator: ChartGenerator;

  constructor(botToken: string) {
    this.botToken = botToken;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
    this.subscribers = new SubscribersManager();
    this.preferences = new UserPreferencesManager();
    this.chartGenerator = new ChartGenerator();
  }

  private t(chatId: string) {
    const lang = this.preferences.getLanguage(chatId);
    return getTranslations(lang);
  }

  private async deleteWebhook(): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/deleteWebhook`, { drop_pending_updates: true });
      logger.debug('Webhook deleted (if any existed)');
    } catch (error: any) {
      logger.debug(`No webhook to delete or error deleting webhook: ${error.message}`);
    }
  }

  setLuxpowerClient(luxpower: LuxpowerClient, plantId: string): void {
    this.luxpower = luxpower;
    this.plantId = plantId;
  }

  setStatusTracker(tracker: () => StatusTracker): void {
    this.statusTracker = tracker;
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      const parts: string[] = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
      return parts.join(' ');
    }
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

  private getMainMenu(chatId?: string): any {
    if (!chatId) {
      chatId = '';
    }
    const t = this.t(chatId);
    const isSubscribed = chatId ? this.subscribers.has(chatId) : false;
    const subscribeButton = isSubscribed 
      ? [{ text: t.buttons.unsubscribe, callback_data: 'unsubscribe' }]
      : [{ text: t.buttons.subscribe, callback_data: 'subscribe' }];
    
    return {
      inline_keyboard: [
        [
          { text: t.buttons.inverterInfo, callback_data: 'info' },
          { text: t.buttons.status, callback_data: 'status' }
        ],
        [
          { text: t.buttons.chart1Day, callback_data: 'chart_24' },
          { text: t.buttons.chart1Week, callback_data: 'chart_168' },
          { text: t.buttons.chart1Month, callback_data: 'chart_720' }
        ],
        subscribeButton,
        [
          { text: t.buttons.help, callback_data: 'help' },
          { text: t.buttons.language, callback_data: 'language' }
        ]
      ]
    };
  }

  async broadcastMessage(text: string): Promise<void> {
    const chatIds = this.subscribers.getAll();
    if (chatIds.length === 0) {
      logger.debug('No subscribers to notify');
      return;
    }

    logger.info(`Broadcasting to ${chatIds.length} subscriber(s)...`);
    const promises = chatIds.map(chatId => 
      this.sendMessage(chatId, text).catch(error => {
        logger.warn(`Failed to send to ${chatId}: ${error.message}`);
      })
    );
    await Promise.all(promises);
  }

  async notifyElectricityAppeared(gridPower: number, previousOffDuration: number = 0): Promise<void> {
    const chatIds = this.subscribers.getAll();
    for (const chatId of chatIds) {
      const t = this.t(chatId);
      const offDurationText = previousOffDuration > 0 ? `${t.notifications.wasOffFor} ${this.formatDuration(previousOffDuration)}` : '';
      const message = `${t.notifications.electricityAppeared}\n\n${t.notifications.gridPower} ${gridPower.toFixed(2)} W${offDurationText}\n${t.notifications.time} ${new Date().toLocaleString()}\n\n${t.notifications.useInfo}`;
      const keyboard = {
        inline_keyboard: [
          [
            { text: t.buttons.inverterInfo, callback_data: 'info' },
            { text: t.buttons.status, callback_data: 'status' }
          ],
          [
            { text: t.buttons.chart1DayFull, callback_data: 'chart_24' },
            { text: t.buttons.chart1WeekFull, callback_data: 'chart_168' }
          ],
          [
            { text: t.buttons.mainMenu, callback_data: 'menu' }
          ]
        ]
      };
      await this.sendMessage(chatId, message, keyboard).catch(error => {
        logger.warn(`Failed to send to ${chatId}: ${error.message}`);
      });
    }
  }

  async notifyElectricityDisappeared(previousOnDuration: number = 0): Promise<void> {
    const chatIds = this.subscribers.getAll();
    for (const chatId of chatIds) {
      const t = this.t(chatId);
      const onDurationText = previousOnDuration > 0 ? `${t.notifications.wasOnFor} ${this.formatDuration(previousOnDuration)}` : '';
      const message = `${t.notifications.electricityDisappeared}${onDurationText}\n\n${t.notifications.time} ${new Date().toLocaleString()}\n\n${t.notifications.useInfo}`;
      const keyboard = {
        inline_keyboard: [
          [
            { text: t.buttons.inverterInfo, callback_data: 'info' },
            { text: t.buttons.status, callback_data: 'status' }
          ],
          [
            { text: t.buttons.chart1DayFull, callback_data: 'chart_24' },
            { text: t.buttons.chart1WeekFull, callback_data: 'chart_168' }
          ],
          [
            { text: t.buttons.mainMenu, callback_data: 'menu' }
          ]
        ]
      };
      await this.sendMessage(chatId, message, keyboard).catch(error => {
        logger.warn(`Failed to send to ${chatId}: ${error.message}`);
      });
    }
  }

  private async broadcastMessageWithKeyboard(text: string, replyMarkup: any): Promise<void> {
    const chatIds = this.subscribers.getAll();
    if (chatIds.length === 0) {
      logger.debug('No subscribers to notify');
      return;
    }

    logger.info(`Broadcasting to ${chatIds.length} subscriber(s)...`);
    const promises = chatIds.map(chatId => 
      this.sendMessage(chatId, text, replyMarkup).catch(error => {
        logger.warn(`Failed to send to ${chatId}: ${error.message}`);
      })
    );
    await Promise.all(promises);
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
            const data = update.callback_query.data;
            const userName = update.callback_query.from.first_name || update.callback_query.from.username || 'User';

            try {
              await axios.post(`${this.apiUrl}/answerCallbackQuery`, {
                callback_query_id: update.callback_query.id
              });

              if (data === 'info') {
                await this.sendInverterInfo(chatId);
              } else if (data === 'status') {
                await this.handleStatusCommand(chatId);
              } else if (data === 'subscribe') {
                await this.handleSubscribe(chatId, userName);
              } else if (data === 'unsubscribe') {
                await this.handleUnsubscribe(chatId, userName);
              } else if (data === 'help') {
                await this.sendHelp(chatId);
              } else if (data === 'menu') {
                const t = this.t(chatId);
                const version = packageJson.version || 'unknown';
                await this.sendMessage(chatId, `${t.menu.mainMenu}\n\n${t.menu.selectOption}\n\n📦 <b>${t.menu.version}</b> ${version}`, this.getMainMenu(chatId));
              } else if (data === 'language') {
                await this.handleLanguageSelection(chatId);
              } else if (data?.startsWith('lang_')) {
                const lang = data.replace('lang_', '') as Language;
                if (lang === 'uk' || lang === 'en') {
                  this.preferences.setLanguage(chatId, lang);
                  const t = this.t(chatId);
                  await this.sendMessage(chatId, `${t.language.changed} ${lang === 'uk' ? '🇺🇦 Українська' : '🇬🇧 English'}`, this.getMainMenu(chatId));
                }
              } else if (data?.startsWith('chart_')) {
                const hours = parseInt(data.replace('chart_', ''), 10);
                await this.sendChart(chatId, hours);
              }
            } catch (cmdError: any) {
              logger.warn(`Error processing callback from ${chatId}: ${cmdError.message}`);
            }
          } else if (update.message?.text && update.message?.chat) {
            const chatId = update.message.chat.id.toString();
            const text = update.message.text.trim().toLowerCase();
            const userName = update.message.chat.first_name || update.message.chat.username || 'User';

            try {
              if (text === '/start') {
                await this.handleSubscribe(chatId, userName);
              } else if (text === '/stop') {
                await this.handleUnsubscribe(chatId, userName);
              } else if (text === '/status') {
                await this.handleStatusCommand(chatId);
              } else if (text === '/info' || text === '/inverter') {
                await this.sendInverterInfo(chatId);
              } else if (text === '/help') {
                await this.sendHelp(chatId);
              } else if (text === '/menu') {
                const t = this.t(chatId);
                const version = packageJson.version || 'unknown';
                await this.sendMessage(chatId, `${t.menu.mainMenu}\n\n${t.menu.selectOption}\n\n📦 <b>${t.menu.version}</b> ${version}`, this.getMainMenu(chatId));
              } else if (text === '/language' || text === '/lang') {
                await this.handleLanguageSelection(chatId);
              } else if (text === '/chart' || text === '/history') {
                await this.sendChart(chatId, 24);
              } else if (text === '/chart_day' || text === '/chart_1d') {
                await this.sendChart(chatId, 24);
              } else if (text === '/chart_week' || text === '/chart_1w') {
                await this.sendChart(chatId, 168);
              } else if (text === '/chart_month' || text === '/chart_1m') {
                await this.sendChart(chatId, 720);
              } else if (text.startsWith('/chart_')) {
                const hoursMatch = text.match(/\/chart_(\d+)/);
                if (hoursMatch) {
                  const hours = parseInt(hoursMatch[1], 10);
                  await this.sendChart(chatId, hours);
                } else {
                  await this.sendChart(chatId, 24);
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

  private async sendInverterInfo(chatId: string): Promise<void> {
    const t = this.t(chatId);
    if (!this.luxpower || !this.plantId) {
      await this.sendMessage(chatId, t.errors.inverterNotAvailable);
      return;
    }

    try {
      const status = await this.luxpower.checkElectricityStatus(this.plantId);
      const data = status.rawData;

      const vact = data.vact || 0;
      const vacr = data.vacr || 0;
      const gridVoltage = vacr > 0 ? (vacr / 10).toFixed(1) : (vact > 0 ? (vact / 10).toFixed(1) : '0.0');
      const powerToGrid = data.pToGrid || 0;
      const powerToUser = data.pToUser || 0;
      const batterySOC = data.soc || 0;
      const batteryVoltage = data.vBat ? (data.vBat / 10).toFixed(1) : '0.0';
      const batteryPower = data.batPower || 0;
      const pv1Voltage = data.vpv1 ? (data.vpv1 / 10).toFixed(1) : '0.0';
      const pv1Power = data.ppv1 || 0;
      const pv2Voltage = data.vpv2 ? (data.vpv2 / 10).toFixed(1) : '0.0';
      const pv2Power = data.ppv2 || 0;
      const pv3Voltage = data.vpv3 ? (data.vpv3 / 10).toFixed(1) : '0.0';
      const pv3Power = data.ppv3 || 0;
      const totalPVPower = pv1Power + pv2Power + pv3Power;
      const inverterPower = data.pinv || 0;
      const epsPower = data.peps || 0;
      const consumptionPower = data.consumptionPower || 0;
      const statusText = data.statusText || 'unknown';
      const deviceTime = data.deviceTime || 'N/A';

      const electricityStatus = status.hasElectricity ? t.inverter.statusOn : t.inverter.statusOff;
      let batteryStatus: string;
      if (batteryPower > 0) {
        batteryStatus = t.inverter.batteryCharging;
      } else if (batteryPower < 0) {
        if (batterySOC >= 100 && Math.abs(batteryPower) < 20) {
          batteryStatus = t.inverter.batteryStandby;
        } else {
          batteryStatus = t.inverter.batteryDischarging;
        }
      } else {
        batteryStatus = t.inverter.batteryStandby;
      }

      let message = `${t.inverter.title}\n\n`;
      message += `${t.inverter.time} ${deviceTime}\n`;
      message += `${t.inverter.systemStatus} ${statusText}\n`;
      
      if (this.statusTracker) {
        const stats = this.statusTracker();
        if (stats.currentDuration > 0) {
          message += `${t.inverter.currentState} ${this.formatDuration(stats.currentDuration)}\n`;
        }
      }
      message += `\n`;
      
      message += `${t.inverter.gridStatus}\n`;
      message += `   ${t.inverter.electricity} ${electricityStatus}\n`;
      message += `   ${t.inverter.voltage} ${gridVoltage} V\n`;
      message += `   ${t.inverter.consumption} ${consumptionPower} W\n`;
      message += `   ${t.inverter.grid} ${powerToUser} W\n`;
      message += `\n`;

      message += `${t.inverter.battery}\n`;
      message += `   ${t.inverter.batteryStatus} ${batteryStatus}\n`;
      message += `   ${t.inverter.soc} ${batterySOC}%\n`;
      message += `   ${t.inverter.voltage} ${batteryVoltage} V\n`;
      message += `   ${t.inverter.power} ${batteryPower} W\n\n`;

      if (totalPVPower > 0 || pv1Voltage !== '0.0' || pv2Voltage !== '0.0' || pv3Voltage !== '0.0') {
        message += `${t.inverter.solarInput}\n`;
        if (pv1Power > 0 || pv1Voltage !== '0.0') {
          message += `   ${t.inverter.pv1} ${pv1Power} W (${pv1Voltage} V)\n`;
        }
        if (pv2Power > 0 || pv2Voltage !== '0.0') {
          message += `   ${t.inverter.pv2} ${pv2Power} W (${pv2Voltage} V)\n`;
        }
        if (pv3Power > 0 || pv3Voltage !== '0.0') {
          message += `   ${t.inverter.pv3} ${pv3Power} W (${pv3Voltage} V)\n`;
        }
        message += `   ${t.inverter.total} ${totalPVPower} W\n\n`;
      }

      message += `${t.inverter.powerFlow}\n`;
      message += `   ${t.inverter.inverter} ${inverterPower} W\n`;
      if (epsPower > 0) {
        message += `   ${t.inverter.epsBackup} ${epsPower} W\n`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: t.buttons.refresh, callback_data: 'info' }],
          [{ text: t.buttons.mainMenu, callback_data: 'menu' }]
        ]
      };

      await this.sendMessage(chatId, message, keyboard);
    } catch (error: any) {
      await this.sendMessage(chatId, `${t.errors.errorFetching} ${error.message}`);
      logger.error(`Error sending inverter info: ${error.message}`);
    }
  }

  private async handleSubscribe(chatId: string, userName: string): Promise<void> {
    const t = this.t(chatId);
    const added = this.subscribers.add(chatId);
    if (added) {
      await this.sendMessage(
        chatId,
        `${t.subscribe.subscribed}\n\n${t.subscribe.willReceive}\n\n${t.subscribe.useButtons}`,
        this.getMainMenu(chatId)
      );
      logger.info(`User ${userName} (${chatId}) subscribed. Total subscribers: ${this.subscribers.count()}`);
    } else {
      await this.sendMessage(
        chatId,
        `${t.subscribe.alreadySubscribed}`,
        this.getMainMenu(chatId)
      );
    }
  }

  private async handleUnsubscribe(chatId: string, userName: string): Promise<void> {
    const t = this.t(chatId);
    const removed = this.subscribers.remove(chatId);
    if (removed) {
      await this.sendMessage(
        chatId,
        `${t.subscribe.unsubscribed}\n\n${t.subscribe.noLongerReceive}\n\n${t.subscribe.useStart}`
      );
      logger.info(`User ${userName} (${chatId}) unsubscribed. Total subscribers: ${this.subscribers.count()}`);
    } else {
      await this.sendMessage(chatId, t.subscribe.notSubscribed);
    }
  }

  private async handleStatusCommand(chatId: string): Promise<void> {
    const t = this.t(chatId);
    let statusInfo = '';
    
    if (this.statusTracker) {
      const stats = this.statusTracker();
      const statusText = stats.currentStatus === true ? t.inverter.statusOn : stats.currentStatus === false ? t.inverter.statusOff : t.inverter.statusUnknown;
      
      statusInfo += `${t.status.title}\n`;
      
      if (stats.statusChangeTime && stats.currentDuration >= 0) {
        const durationFormatted = this.formatDuration(stats.currentDuration);
        statusInfo += `${t.status.current} ${statusText} (${durationFormatted})\n`;
        statusInfo += `${t.status.since} ${stats.statusChangeTime.toLocaleString()}\n`;
      } else if (stats.statusChangeTime) {
        const durationFormatted = this.formatDuration(Math.abs(stats.currentDuration));
        statusInfo += `${t.status.current} ${statusText} (${durationFormatted})\n`;
        statusInfo += `${t.status.since} ${stats.statusChangeTime.toLocaleString()}\n`;
      } else {
        statusInfo += `${t.status.current} ${statusText}\n`;
      }
      
      if (stats.sessionDuration > 0) {
        const sessionHours = Math.floor(stats.sessionDuration / 3600);
        const sessionMinutes = Math.floor((stats.sessionDuration % 3600) / 60);
        statusInfo += `\n${t.status.sessionStats}\n`;
        statusInfo += `${t.status.totalOnTime} ${this.formatDuration(stats.totalOnTime)}\n`;
        statusInfo += `${t.status.totalOffTime} ${this.formatDuration(stats.totalOffTime)}\n`;
        statusInfo += `${t.status.sessionDuration} ${sessionHours > 0 ? `${sessionHours}h ` : ''}${sessionMinutes}m`;
      }
    } else {
      statusInfo = `${t.status.title}\n\n${t.status.notAvailable}`;
    }
    
    await this.sendMessage(chatId, statusInfo, this.getMainMenu(chatId));
  }

  private async sendChart(chatId: string, hours: number = 24): Promise<void> {
    const t = this.t(chatId);
    if (!this.luxpower || !this.plantId) {
      await this.sendMessage(chatId, t.charts.notAvailable);
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

      await this.sendMessage(chatId, `${t.charts.generating} ${periodLabel}...`);

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));
      
      const historyData = await this.luxpower.getHistoryData(this.plantId, startDate, endDate);

      if (historyData.length === 0) {
        await this.sendMessage(chatId, `${t.charts.noData} ${periodLabel}.`);
        return;
      }

      const lang = this.preferences.getLanguage(chatId);
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

      const keyboard = {
        inline_keyboard: [
          [
            { text: t.buttons.refresh, callback_data: `chart_${hours}` },
            { text: t.buttons.chart1Day, callback_data: 'chart_24' },
            { text: t.buttons.chart1Week, callback_data: 'chart_168' },
            { text: t.buttons.chart1Month, callback_data: 'chart_720' }
          ],
          [
            { text: t.buttons.mainMenu, callback_data: 'menu' }
          ]
        ]
      };

      await this.sendMessage(chatId, t.charts.selectTimeRange, keyboard);
    } catch (error: any) {
      logger.error(`Error sending chart: ${error.message}`);
      await this.sendMessage(chatId, `${t.charts.error} ${error.message}`);
    }
  }

  private async sendHelp(chatId: string): Promise<void> {
    const t = this.t(chatId);
    const version = packageJson.version || 'unknown';
    const message = `${t.help.title}\n\n` +
      `${t.help.mainCommands}\n` +
      `${t.help.start}\n` +
      `${t.help.stop}\n` +
      `${t.help.menu}\n\n` +
      `${t.help.statusInfo}\n` +
      `${t.help.status}\n` +
      `${t.help.info}\n\n` +
      `${t.help.charts}\n` +
      `${t.help.chart}\n` +
      `${t.help.chartWeek}\n` +
      `${t.help.chartMonth}\n\n` +
      `${t.help.other}\n` +
      `${t.help.help}\n\n` +
      `${t.help.useButtons}\n\n` +
      `${t.help.autoNotify}\n\n` +
      `${t.help.version} ${version}`;
    
    await this.sendMessage(chatId, message, this.getMainMenu(chatId));
  }

  private async handleLanguageSelection(chatId: string): Promise<void> {
    const t = this.t(chatId);
    const currentLang = this.preferences.getLanguage(chatId);
    const keyboard = {
      inline_keyboard: [
        [
          { text: `🇺🇦 Українсьka${currentLang === 'uk' ? ' ✓' : ''}`, callback_data: 'lang_uk' },
          { text: `🇬🇧 English${currentLang === 'en' ? ' ✓' : ''}`, callback_data: 'lang_en' }
        ],
        [
          { text: t.buttons.mainMenu, callback_data: 'menu' }
        ]
      ]
    };
    await this.sendMessage(chatId, `${t.language.current} ${currentLang === 'uk' ? '🇺🇦 Українська' : '🇬🇧 English'}\n\n${t.language.select}`, keyboard);
  }
}
