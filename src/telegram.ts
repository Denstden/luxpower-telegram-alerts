import axios, { AxiosResponse } from 'axios';
import { SubscribersManager } from './subscribers';
import { LuxpowerClient } from './luxpower';

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
}

export class TelegramBot {
  private botToken: string;
  private apiUrl: string;
  private subscribers: SubscribersManager;
  private lastUpdateId: number = 0;
  private luxpower: LuxpowerClient | null = null;
  private plantId: string | null = null;

  constructor(botToken: string) {
    this.botToken = botToken;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
    this.subscribers = new SubscribersManager();
  }

  setLuxpowerClient(luxpower: LuxpowerClient, plantId: string): void {
    this.luxpower = luxpower;
    this.plantId = plantId;
  }

  async sendMessage(chatId: string, text: string): Promise<TelegramResponse> {
    try {
      const response: AxiosResponse<TelegramResponse> = await axios.post(
        `${this.apiUrl}/sendMessage`,
        {
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        }
      );

      return response.data;
    } catch (error: any) {
      console.error(`Telegram send message error to ${chatId}:`, error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  async broadcastMessage(text: string): Promise<void> {
    const chatIds = this.subscribers.getAll();
    if (chatIds.length === 0) {
      console.log('No subscribers to notify');
      return;
    }

    console.log(`Broadcasting to ${chatIds.length} subscriber(s)...`);
    const promises = chatIds.map(chatId => 
      this.sendMessage(chatId, text).catch(error => {
        console.error(`Failed to send to ${chatId}:`, error.message);
      })
    );
    await Promise.all(promises);
  }

  async notifyElectricityAppeared(gridPower: number): Promise<void> {
    const message = `⚡ <b>Electricity Appeared!</b>\n\nGrid Power: ${gridPower.toFixed(2)} W\nTime: ${new Date().toLocaleString()}`;
    await this.broadcastMessage(message);
  }

  async notifyElectricityDisappeared(): Promise<void> {
    const message = `🔌 <b>Electricity Disappeared!</b>\n\nTime: ${new Date().toLocaleString()}`;
    await this.broadcastMessage(message);
  }

  async handleUpdates(): Promise<void> {
    try {
      const response: AxiosResponse<{ ok: boolean; result: TelegramUpdate[] }> = await axios.get(
        `${this.apiUrl}/getUpdates`,
        {
          params: {
            offset: this.lastUpdateId + 1,
            timeout: 10,
            allowed_updates: ['message']
          },
          timeout: 12000
        }
      );

      if (response.data.ok && response.data.result) {
        for (const update of response.data.result) {
          if (update.update_id > this.lastUpdateId) {
            this.lastUpdateId = update.update_id;
          }

          if (update.message?.text && update.message?.chat) {
            const chatId = update.message.chat.id.toString();
            const text = update.message.text.trim().toLowerCase();
            const userName = update.message.chat.first_name || update.message.chat.username || 'User';

            try {
              if (text === '/start') {
                const added = this.subscribers.add(chatId);
                if (added) {
                  await this.sendMessage(chatId, `✅ <b>Subscribed!</b>\n\nYou will now receive electricity status notifications.\n\nUse /stop to unsubscribe.`);
                  console.log(`User ${userName} (${chatId}) subscribed. Total subscribers: ${this.subscribers.count()}`);
                } else {
                  await this.sendMessage(chatId, `You are already subscribed! Use /stop to unsubscribe.`);
                }
              } else if (text === '/stop') {
                const removed = this.subscribers.remove(chatId);
                if (removed) {
                  await this.sendMessage(chatId, `❌ <b>Unsubscribed</b>\n\nYou will no longer receive notifications.\n\nUse /start to subscribe again.`);
                  console.log(`User ${userName} (${chatId}) unsubscribed. Total subscribers: ${this.subscribers.count()}`);
                } else {
                  await this.sendMessage(chatId, `You are not subscribed. Use /start to subscribe.`);
                }
              } else if (text === '/status') {
                const isSubscribed = this.subscribers.has(chatId);
                const totalSubscribers = this.subscribers.count();
                await this.sendMessage(chatId, 
                  `📊 <b>Subscription Status</b>\n\n` +
                  `Your subscription: ${isSubscribed ? '✅ Active' : '❌ Not subscribed'}\n` +
                  `Total subscribers: ${totalSubscribers}\n\n` +
                  `Use /start to subscribe\n` +
                  `Use /stop to unsubscribe`
                );
              } else if (text === '/info' || text === '/inverter') {
                await this.sendInverterInfo(chatId);
              } else if (text === '/help') {
                await this.sendHelp(chatId);
              }
            } catch (cmdError: any) {
              console.error(`Error processing command from ${chatId}:`, cmdError.message);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        console.log('Telegram API conflict (409) - another instance may be polling. This is normal if multiple instances are running.');
        return;
      }
      if (error.response?.status === 429) {
        console.log('Telegram API rate limit (429) - waiting before next poll...');
        return;
      }
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return;
      }
      if (error.code !== 'ECONNABORTED') {
        console.error('Error handling Telegram updates:', error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
      }
    }
  }

  startCommandPolling(intervalMs: number = 5000): void {
    setInterval(() => {
      this.handleUpdates().catch(error => {
        console.error('Error in command polling:', error.message);
      });
    }, intervalMs);
    console.log('Telegram command polling started');
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

      const gridVoltage = data.vact ? (data.vact / 100).toFixed(1) : '0.0';
      const gridFrequency = data.fac ? (data.fac / 100).toFixed(2) : '0.00';
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
      const batteryStatus = batteryPower > 0 ? '🔋 Charging' : batteryPower < 0 ? '⚡ Discharging' : '⚪ Idle';

      let message = `⚡ <b>Inverter Status</b>\n\n`;
      message += `📅 <b>Time:</b> ${deviceTime}\n`;
      message += `🔄 <b>System Status:</b> ${statusText}\n\n`;
      
      message += `🔌 <b>Grid</b>\n`;
      message += `   Status: ${electricityStatus}\n`;
      message += `   Voltage: ${gridVoltage} V\n`;
      message += `   Frequency: ${gridFrequency} Hz\n`;
      message += `   To Grid: ${powerToGrid} W\n`;
      message += `   To User: ${powerToUser} W\n\n`;

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
      if (consumptionPower > 0) {
        message += `   Consumption: ${consumptionPower} W\n`;
      }

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      await this.sendMessage(chatId, `❌ Error fetching inverter information: ${error.message}`);
      console.error('Error sending inverter info:', error.message);
    }
  }

  private async sendHelp(chatId: string): Promise<void> {
    const message = `📖 <b>Available Commands</b>\n\n` +
      `/start - Subscribe to electricity notifications\n` +
      `/stop - Unsubscribe from notifications\n` +
      `/status - Check your subscription status\n` +
      `/info - Get current inverter status\n` +
      `/help - Show this help message\n\n` +
      `The bot will automatically notify you when electricity appears or disappears.`;
    
    await this.sendMessage(chatId, message);
  }
}
