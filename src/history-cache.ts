import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

const CACHE_DIR = path.join(process.cwd(), 'history-cache');

interface HistoryPoint {
    timestamp: string;
    hasElectricity: boolean;
}

export class HistoryCache {
    constructor() {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
    }

    private getCacheFilePath(date: string): string {
        return path.join(CACHE_DIR, `${date}.json`);
    }

    getCachedData(date: string, maxAgeHours: number = 1): HistoryPoint[] | null {
        try {
            const filePath = this.getCacheFilePath(date);
            if (fs.existsSync(filePath)) {
                const today = new Date().toISOString().split('T')[0];
                const isToday = date === today;
                
                if (isToday) {
                    const stats = fs.statSync(filePath);
                    const now = new Date();
                    const fileAge = (now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60);
                    
                    if (fileAge >= maxAgeHours) {
                        return null;
                    }
                }
                
                const content = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                if (Array.isArray(data)) {
                    return data;
                }
            }
        } catch (error: any) {
            logger.warn(`Error reading cache for ${date}: ${error.message}`);
        }
        return null;
    }

    isCacheComplete(date: string): boolean {
        try {
            const filePath = this.getCacheFilePath(date);
            if (!fs.existsSync(filePath)) {
                return false;
            }

            const today = new Date().toISOString().split('T')[0];
            const isToday = date === today;
            
            if (isToday) {
                return true;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const cachedData = JSON.parse(content);
            if (!Array.isArray(cachedData) || cachedData.length === 0) {
                return false;
            }

            const dateObj = new Date(date + 'T00:00:00');
            const dayStart = new Date(dateObj);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dateObj);
            dayEnd.setHours(23, 59, 59, 999);

            const dayStartTime = dayStart.getTime();
            const dayEndTime = dayEnd.getTime();

            let hasLateData = false;
            for (const point of cachedData) {
                const pointTime = new Date(point.timestamp).getTime();
                if (pointTime >= dayStartTime && pointTime <= dayEndTime) {
                    const pointDate = new Date(point.timestamp);
                    const hour = pointDate.getHours();
                    if (hour >= 23) {
                        hasLateData = true;
                        break;
                    }
                }
            }

            return hasLateData;
        } catch (error: any) {
            logger.warn(`Error checking cache completeness for ${date}: ${error.message}`);
            return false;
        }
    }

    saveCachedData(date: string, data: HistoryPoint[]): void {
        try {
            const filePath = this.getCacheFilePath(date);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error: any) {
            logger.warn(`Error saving cache for ${date}: ${error.message}`);
        }
    }

    clearOldCache(daysToKeep: number = 30): void {
        try {
            const files = fs.readdirSync(CACHE_DIR);
            const now = new Date();
            const cutoffDate = new Date(now.getTime() - (daysToKeep * 24 * 60 * 60 * 1000));

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const dateStr = file.replace('.json', '');
                    const fileDate = new Date(dateStr);
                    if (fileDate < cutoffDate) {
                        const filePath = path.join(CACHE_DIR, file);
                        fs.unlinkSync(filePath);
                        logger.debug(`Deleted old cache file: ${file}`);
                    }
                }
            }
        } catch (error: any) {
            logger.warn(`Error clearing old cache: ${error.message}`);
        }
    }
}
