import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

const STATUS_FILE = path.join(process.cwd(), 'status.json');

export interface StatusData {
  currentStatus: boolean | null;
  statusChangeTime: string | null;
  totalOnTime: number;
  totalOffTime: number;
  sessionStartTime: string;
}

export class StatusPersistence {
  private data: StatusData;

  constructor() {
    this.data = this.load();
  }

  private load(): StatusData {
    try {
      if (fs.existsSync(STATUS_FILE)) {
        const content = fs.readFileSync(STATUS_FILE, 'utf-8');
        const data = JSON.parse(content);
        const loaded = {
          currentStatus: data.currentStatus ?? null,
          statusChangeTime: data.statusChangeTime ?? null,
          totalOnTime: data.totalOnTime ?? 0,
          totalOffTime: data.totalOffTime ?? 0,
          sessionStartTime: data.sessionStartTime ?? new Date().toISOString()
        };
        return loaded;
      }
    } catch (error: any) {
      logger.error(`Error loading status data: ${error.message}`);
    }

    return {
      currentStatus: null,
      statusChangeTime: null,
      totalOnTime: 0,
      totalOffTime: 0,
      sessionStartTime: new Date().toISOString()
    };
  }

  save(): void {
    try {
      fs.writeFileSync(STATUS_FILE, JSON.stringify(this.data, null, 2));
    } catch (error: any) {
      logger.error(`Error saving status data: ${error.message}`);
    }
  }

  getCurrentStatus(): boolean | null {
    return this.data.currentStatus;
  }

  getStatusChangeTime(): Date | null {
    if (!this.data.statusChangeTime) {
      return null;
    }
    
    if (/^\d+$/.test(this.data.statusChangeTime)) {
      return new Date(parseInt(this.data.statusChangeTime));
    }
    return new Date(this.data.statusChangeTime);
  }

  getTotalOnTime(): number {
    return this.data.totalOnTime;
  }

  getTotalOffTime(): number {
    return this.data.totalOffTime;
  }

  getSessionStartTime(): Date {
    if (/^\d+$/.test(this.data.sessionStartTime)) {
      return new Date(parseInt(this.data.sessionStartTime));
    }
    return new Date(this.data.sessionStartTime);
  }

  updateStatus(newStatus: boolean, changeTime: Date, onDuration: number = 0, offDuration: number = 0): void {
    const previousStatus = this.data.currentStatus;
    
    if (previousStatus === true && newStatus === false) {
      this.data.totalOnTime += onDuration;
    } else if (previousStatus === false && newStatus === true) {
      this.data.totalOffTime += offDuration;
    }
    
    this.data.currentStatus = newStatus;
    this.data.statusChangeTime = changeTime.getTime().toString();
    this.save();
  }

  getData(): StatusData {
    return { ...this.data };
  }
}

