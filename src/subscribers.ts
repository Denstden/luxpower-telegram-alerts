import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { ensureJsonFileExists } from './file-utils';

const SUBSCRIBERS_FILE = path.join(process.cwd(), 'subscribers.json');

export class SubscribersManager {
  private subscribers: Set<string> = new Set();

  constructor() {
    this.ensureFileExists();
    this.load();
  }

  private ensureFileExists(): void {
    ensureJsonFileExists(SUBSCRIBERS_FILE, '[]', 'subscribers.json');
  }

  private load(): void {
    try {
      if (fs.existsSync(SUBSCRIBERS_FILE)) {
        const stats = fs.statSync(SUBSCRIBERS_FILE);
        if (stats.isFile()) {
          const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
          const chatIds = JSON.parse(data);
          if (Array.isArray(chatIds)) {
            this.subscribers = new Set(chatIds);
          }
        }
      }
    } catch (error: any) {
      logger.error(`Error loading subscribers: ${error.message}`);
    }
  }

  private save(): void {
    try {
      const chatIds = Array.from(this.subscribers);
      fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(chatIds, null, 2));
    } catch (error: any) {
      logger.error(`Error saving subscribers: ${error.message}`);
    }
  }

  add(chatId: string): boolean {
    if (this.subscribers.has(chatId)) {
      logger.debug(`ChatId ${chatId} already in subscribers set`);
      return false;
    }
    this.subscribers.add(chatId);
    this.save();
    logger.debug(`Added chatId ${chatId}, total subscribers: ${this.subscribers.size}`);
    return true;
  }

  forceAdd(chatId: string): boolean {
    const wasPresent = this.subscribers.has(chatId);
    this.subscribers.add(chatId);
    this.save();
    logger.debug(`Force added chatId ${chatId} (was present: ${wasPresent}), total subscribers: ${this.subscribers.size}`);
    return !wasPresent;
  }

  remove(chatId: string): boolean {
    if (!this.subscribers.has(chatId)) {
      return false;
    }
    this.subscribers.delete(chatId);
    this.save();
    return true;
  }

  getAll(): string[] {
    return Array.from(this.subscribers);
  }

  has(chatId: string): boolean {
    return this.subscribers.has(chatId);
  }

  count(): number {
    return this.subscribers.size;
  }
}

