class Logger {
    private formatTimestamp(): string {
        const now = new Date();
        return now.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = this.formatTimestamp();
        return `[${timestamp}] [${level}] ${message}`;
    }

    info(message: string): void {
        console.log(this.formatMessage('INFO', message));
    }

    warn(message: string): void {
        console.warn(this.formatMessage('WARN', message));
    }

    error(message: string): void {
        console.error(this.formatMessage('ERROR', message));
    }

    debug(message: string): void {
        if (process.env.DEBUG === 'true') {
            console.log(this.formatMessage('DEBUG', message));
        }
    }
}

export const logger = new Logger();
