import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { Language } from './translations';

const PREFERENCES_FILE = path.join(process.cwd(), 'user-preferences.json');

interface UserPreferences {
  language: Language;
}

interface PreferencesData {
  [chatId: string]: UserPreferences;
}

export class UserPreferencesManager {
  private preferences: PreferencesData = {};

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(PREFERENCES_FILE)) {
        const data = fs.readFileSync(PREFERENCES_FILE, 'utf-8');
        this.preferences = JSON.parse(data);
      }
    } catch (error: any) {
      logger.error(`Error loading user preferences: ${error.message}`);
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(this.preferences, null, 2));
    } catch (error: any) {
      logger.error(`Error saving user preferences: ${error.message}`);
    }
  }

  getLanguage(chatId: string): Language {
    return this.preferences[chatId]?.language || 'en';
  }

  setLanguage(chatId: string, language: Language): void {
    if (!this.preferences[chatId]) {
      this.preferences[chatId] = { language };
    } else {
      this.preferences[chatId].language = language;
    }
    this.save();
  }

  remove(chatId: string): void {
    delete this.preferences[chatId];
    this.save();
  }
}
