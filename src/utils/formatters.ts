import {getHour12Format, getLocaleString, getTranslations, Language} from './translations';

export function formatTime(date: Date, lang: Language, showDate: boolean = false): string {
    const locale = getLocaleString(lang);
    const hour12 = getHour12Format(lang);

    if (showDate) {
        const formatter = new Intl.DateTimeFormat(locale, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12
        });
        return formatter.format(date);
    }

    const formatter = new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12
    });
    return formatter.format(date);
}

export function formatDate(date: Date, lang: Language): string {
    const locale = getLocaleString(lang);
    const formatter = new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric'
    });
    return formatter.format(date);
}

export function formatDateTime(date: Date, lang: Language): string {
    const locale = getLocaleString(lang);
    const hour12 = getHour12Format(lang);

    return date.toLocaleString(locale, {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12
    });
}

export function formatDuration(milliseconds: number, lang: Language): string {
    const t = getTranslations(lang);
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}${t.duration.days}`);
    if (hours > 0) parts.push(`${hours}${t.duration.hours}`);
    if (minutes > 0) parts.push(`${minutes}${t.duration.minutes}`);
    if (seconds > 0 && parts.length === 0) parts.push(`${seconds}${t.duration.seconds}`);

    return parts.length > 0 ? parts.join(' ') : `0${t.duration.seconds}`;
}

export function formatDurationSeconds(seconds: number, lang: Language): string {
    const t = getTranslations(lang);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}${t.duration.days}`);
    if (hours > 0) parts.push(`${hours}${t.duration.hours}`);
    if (minutes > 0) parts.push(`${minutes}${t.duration.minutes}`);
    if (secs > 0 && parts.length === 0) parts.push(`${secs}${t.duration.seconds}`);
    if (secs > 0 && parts.length > 0 && parts.length < 3) parts.push(`${secs}${t.duration.seconds}`);

    return parts.length > 0 ? parts.join(' ') : `0${t.duration.seconds}`;
}
