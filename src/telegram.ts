import axios, { AxiosResponse } from 'axios';
import { SubscribersManager } from './subscribers';
import { LuxpowerClient } from './luxpower';
import { ChartGenerator } from './chart-generator';
import * as packageJson from '../package.json';
import FormData from 'form-data';
import { logger } from './logger';

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
    this.chartGenerator = new ChartGenerator();
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
    const isSubscribed = chatId ? this.subscribers.has(chatId) : false;
    const subscribeButton = isSubscribed 
      ? [{ text: '❌ Unsubscribe', callback_data: 'unsubscribe' }]
      : [{ text: '✅ Subscribe', callback_data: 'subscribe' }];
    
    return {
      inline_keyboard: [
        [
          { text: '📊 Inverter Info', callback_data: 'info' },
          { text: '📈 Status', callback_data: 'status' }
        ],
        [
          { text: '📉 1 Day', callback_data: 'chart_24' },
          { text: '📉 1 Week', callback_data: 'chart_168' },
          { text: '📉 1 Month', callback_data: 'chart_720' }
        ],
        subscribeButton,
        [
          { text: 'ℹ️ Help', callback_data: 'help' }
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
    const offDurationText = previousOffDuration > 0 ? `\n⚫ Was off for: ${this.formatDuration(previousOffDuration)}` : '';
    const message = `⚡ <b>Electricity Appeared!</b>\n\nGrid Power: ${gridPower.toFixed(2)} W${offDurationText}\nTime: ${new Date().toLocaleString()}\n\nUse /info to see full inverter status.`;
    const keyboard = {
      inline_keyboard: [[{ text: '📊 View Inverter Info', callback_data: 'info' }]]
    };
    await this.broadcastMessageWithKeyboard(message, keyboard);
  }

  async notifyElectricityDisappeared(previousOnDuration: number = 0): Promise<void> {
    const onDurationText = previousOnDuration > 0 ? `\n⚫ Was on for: ${this.formatDuration(previousOnDuration)}` : '';
    const message = `🔌 <b>Electricity Disappeared!</b>${onDurationText}\n\nTime: ${new Date().toLocaleString()}\n\nUse /info to see full inverter status.`;
    const keyboard = {
      inline_keyboard: [[{ text: '📊 View Inverter Info', callback_data: 'info' }]]
    };
    await this.broadcastMessageWithKeyboard(message, keyboard);
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
                const version = packageJson.version || 'unknown';
                await this.sendMessage(chatId, `🏠 <b>Main Menu</b>\n\nSelect an option:\n\n📦 <b>Version:</b> ${version}`, this.getMainMenu(chatId));
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
                const version = packageJson.version || 'unknown';
                await this.sendMessage(chatId, `🏠 <b>Main Menu</b>\n\nSelect an option:\n\n📦 <b>Version:</b> ${version}`, this.getMainMenu(chatId));
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
    if (!this.luxpower || !this.plantId) {
      await this.sendMessage(chatId, '❌ Inverter information is not available. The service may not be fully configured.');
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

      const electricityStatus = status.hasElectricity ? '🟢 ON' : '🔴 OFF';
      let batteryStatus: string;
      if (batteryPower > 0) {
        batteryStatus = '🔋 Charging';
      } else if (batteryPower < 0) {
        if (batterySOC >= 100 && Math.abs(batteryPower) < 20) {
          batteryStatus = '⚪ Standby';
        } else {
          batteryStatus = '⚡ Discharging';
        }
      } else {
        batteryStatus = '⚪ Standby';
      }

      let message = `⚡ <b>Inverter Status</b>\n\n`;
      message += `📅 <b>Time:</b> ${deviceTime}\n`;
      message += `🔄 <b>System Status:</b> ${statusText}\n`;
      
      if (this.statusTracker) {
        const stats = this.statusTracker();
        if (stats.currentDuration > 0) {
          message += `⏱️ <b>Current state:</b> ${this.formatDuration(stats.currentDuration)}\n`;
        }
      }
      message += `\n`;
      
      message += `🔌 <b>Grid Status</b>\n`;
      message += `   Electricity: ${electricityStatus}\n`;
      message += `   Voltage: ${gridVoltage} V\n`;
      message += `   Consumption: ${consumptionPower} W\n`;
      message += `   GRID: ${powerToUser} W\n`;
      message += `\n`;

      message += `🔋 <b>Battery</b>\n`;
      message += `   Status: ${batteryStatus}\n`;
      message += `   SOC: ${batterySOC}%\n`;
      message += `   Voltage: ${batteryVoltage} V\n`;
      message += `   Power: ${batteryPower} W\n\n`;

      if (totalPVPower > 0 || pv1Voltage !== '0.0' || pv2Voltage !== '0.0' || pv3Voltage !== '0.0') {
        message += `☀️ <b>Solar Input</b>\n`;
        if (pv1Power > 0 || pv1Voltage !== '0.0') {
          message += `   PV1: ${pv1Power} W (${pv1Voltage} V)\n`;
        }
        if (pv2Power > 0 || pv2Voltage !== '0.0') {
          message += `   PV2: ${pv2Power} W (${pv2Voltage} V)\n`;
        }
        if (pv3Power > 0 || pv3Voltage !== '0.0') {
          message += `   PV3: ${pv3Power} W (${pv3Voltage} V)\n`;
        }
        message += `   Total: ${totalPVPower} W\n\n`;
      }

      message += `⚙️ <b>Power Flow</b>\n`;
      message += `   Inverter: ${inverterPower} W\n`;
      if (epsPower > 0) {
        message += `   EPS Backup: ${epsPower} W\n`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '🔄 Refresh', callback_data: 'info' }],
          [{ text: '🏠 Main Menu', callback_data: 'menu' }]
        ]
      };

      await this.sendMessage(chatId, message, keyboard);
    } catch (error: any) {
      await this.sendMessage(chatId, `❌ Error fetching inverter information: ${error.message}`);
      logger.error(`Error sending inverter info: ${error.message}`);
    }
  }

  private async handleSubscribe(chatId: string, userName: string): Promise<void> {
    const added = this.subscribers.add(chatId);
    if (added) {
      await this.sendMessage(
        chatId,
        `✅ <b>Subscribed!</b>\n\nYou will now receive electricity status notifications.\n\nUse the buttons below to interact with the bot.`,
        this.getMainMenu(chatId)
      );
      logger.info(`User ${userName} (${chatId}) subscribed. Total subscribers: ${this.subscribers.count()}`);
    } else {
      await this.sendMessage(
        chatId,
        `You are already subscribed! Use the buttons below to interact with the bot.`,
        this.getMainMenu(chatId)
      );
    }
  }

  private async handleUnsubscribe(chatId: string, userName: string): Promise<void> {
    const removed = this.subscribers.remove(chatId);
    if (removed) {
      await this.sendMessage(
        chatId,
        `❌ <b>Unsubscribed</b>\n\nYou will no longer receive notifications.\n\nUse /start to subscribe again.`
      );
      logger.info(`User ${userName} (${chatId}) unsubscribed. Total subscribers: ${this.subscribers.count()}`);
    } else {
      await this.sendMessage(chatId, `You are not subscribed. Use /start to subscribe.`);
    }
  }

  private async handleStatusCommand(chatId: string): Promise<void> {
    let statusInfo = '';
    
    if (this.statusTracker) {
      const stats = this.statusTracker();
      const statusText = stats.currentStatus === true ? '🟢 ON' : stats.currentStatus === false ? '🔴 OFF' : '⚪ Unknown';
      
      statusInfo += `⚡ <b>Electricity Status</b>\n`;
      
      if (stats.statusChangeTime && stats.currentDuration >= 0) {
        const durationFormatted = this.formatDuration(stats.currentDuration);
        statusInfo += `Current: ${statusText} (${durationFormatted})\n`;
        statusInfo += `Since: ${stats.statusChangeTime.toLocaleString()}\n`;
      } else if (stats.statusChangeTime) {
        const durationFormatted = this.formatDuration(Math.abs(stats.currentDuration));
        statusInfo += `Current: ${statusText} (${durationFormatted})\n`;
        statusInfo += `Since: ${stats.statusChangeTime.toLocaleString()}\n`;
      } else {
        statusInfo += `Current: ${statusText}\n`;
      }
      
      if (stats.sessionDuration > 0) {
        const sessionHours = Math.floor(stats.sessionDuration / 3600);
        const sessionMinutes = Math.floor((stats.sessionDuration % 3600) / 60);
        statusInfo += `\n📈 <b>Session Stats</b> (since service start)\n`;
        statusInfo += `Total ON time: ${this.formatDuration(stats.totalOnTime)}\n`;
        statusInfo += `Total OFF time: ${this.formatDuration(stats.totalOffTime)}\n`;
        statusInfo += `Session duration: ${sessionHours > 0 ? `${sessionHours}h ` : ''}${sessionMinutes}m`;
      }
    } else {
      statusInfo = '⚡ <b>Electricity Status</b>\n\nStatus tracking is not available.';
    }
    
    await this.sendMessage(chatId, statusInfo, this.getMainMenu(chatId));
  }

  private async sendChart(chatId: string, hours: number = 24): Promise<void> {
    if (!this.luxpower || !this.plantId) {
      await this.sendMessage(chatId, '❌ Chart generation is not available. The service may not be fully configured.');
      return;
    }

    try {
      let periodLabel = '';
      if (hours === 24) {
        periodLabel = '1 Day';
      } else if (hours === 168) {
        periodLabel = '1 Week';
      } else if (hours === 720) {
        periodLabel = '1 Month';
      } else {
        periodLabel = `${hours} hours`;
      }

      await this.sendMessage(chatId, `📊 Generating chart for ${periodLabel}...`);

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));
      
      const historyData = await this.luxpower.getHistoryData(this.plantId, startDate, endDate);

      if (historyData.length === 0) {
        await this.sendMessage(chatId, `❌ No history data available for ${periodLabel}.`);
        return;
      }

      const chartBuffer = await this.chartGenerator.generateTimelineChart(historyData, hours);
      
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', chartBuffer, {
        filename: 'chart.png',
        contentType: 'image/png'
      });
      formData.append('caption', `📊 <b>Electricity Status History</b>\n\n${periodLabel}\n\n🟢 Green = ON | 🔴 Red = OFF`);
      formData.append('parse_mode', 'HTML');

      await axios.post(`${this.apiUrl}/sendPhoto`, formData, {
        headers: formData.getHeaders()
      });

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: `chart_${hours}` },
            { text: '📉 1 Day', callback_data: 'chart_24' },
            { text: '📉 1 Week', callback_data: 'chart_168' },
            { text: '📉 1 Month', callback_data: 'chart_720' }
          ],
          [
            { text: '🏠 Main Menu', callback_data: 'menu' }
          ]
        ]
      };

      await this.sendMessage(chatId, 'Select a time range:', keyboard);
    } catch (error: any) {
      logger.error(`Error sending chart: ${error.message}`);
      await this.sendMessage(chatId, `❌ Error generating chart: ${error.message}`);
    }
  }

  private async sendHelp(chatId: string): Promise<void> {
    const version = packageJson.version || 'unknown';
    const isSubscribed = this.subscribers.has(chatId);
    const message = `📖 <b>Available Commands</b>\n\n` +
      `<b>Main Commands:</b>\n` +
      `/start - Subscribe to notifications\n` +
      `/stop - Unsubscribe from notifications\n` +
      `/menu - Show main menu with buttons\n\n` +
      `<b>Status & Info:</b>\n` +
      `/status - Check electricity status and statistics\n` +
      `/info or /inverter - Get detailed inverter information\n\n` +
      `<b>Charts:</b>\n` +
      `/chart or /chart_day - View 1 day chart\n` +
      `/chart_week - View 1 week chart\n` +
      `/chart_month - View 1 month chart\n\n` +
      `<b>Other:</b>\n` +
      `/help - Show this help message\n\n` +
      `You can also use the buttons in the menu for quick access.\n\n` +
      `The bot will automatically notify you when electricity appears or disappears.\n\n` +
      `📦 <b>Version:</b> ${version}`;
    
    await this.sendMessage(chatId, message, this.getMainMenu(chatId));
  }
}
