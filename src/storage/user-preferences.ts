import * as fs from 'fs';
import * as path from 'path';
import {ensureJsonFileExists, Language, logger} from '../utils';

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
        this.ensureFileExists();
        this.load();
    }

    private ensureFileExists(): void {
        ensureJsonFileExists(PREFERENCES_FILE, '{}', 'user-preferences.json');
    }

    private load(): void {
        try {
            if (fs.existsSync(PREFERENCES_FILE)) {
                const stats = fs.statSync(PREFERENCES_FILE);
                if (stats.isFile()) {
                    const data = fs.readFileSync(PREFERENCES_FILE, 'utf-8');
                    this.preferences = JSON.parse(data);
                }
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

    getLanguage(chatId: string, defaultLang: Language = 'en'): Language {
        return this.preferences[chatId]?.language || defaultLang;
    }

    setLanguage(chatId: string, language: Language): void {
        if (!this.preferences[chatId]) {
            this.preferences[chatId] = {language};
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
