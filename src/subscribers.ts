import * as fs from 'fs';
import * as path from 'path';

const SUBSCRIBERS_FILE = path.join(process.cwd(), 'subscribers.json');

export class SubscribersManager {
  private subscribers: Set<string> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(SUBSCRIBERS_FILE)) {
        const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
        const chatIds = JSON.parse(data);
        if (Array.isArray(chatIds)) {
          this.subscribers = new Set(chatIds);
        }
      }
    } catch (error: any) {
      console.error('Error loading subscribers:', error.message);
    }
  }

  private save(): void {
    try {
      const chatIds = Array.from(this.subscribers);
      fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(chatIds, null, 2));
    } catch (error: any) {
      console.error('Error saving subscribers:', error.message);
    }
  }

  add(chatId: string): boolean {
    if (this.subscribers.has(chatId)) {
      return false;
    }
    this.subscribers.add(chatId);
    this.save();
    return true;
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

