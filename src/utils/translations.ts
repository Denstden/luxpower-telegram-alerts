import type {Locales, Translation} from '../i18n/i18n-types';
import en from '../i18n/en/index';
import uk from '../i18n/uk/index';

export type Language = Locales;

export const DEFAULT_LANGUAGE: Language = 'en';
export const DEFAULT_GROUP_LANGUAGE: Language = 'uk';
export const DEFAULT_PRIVATE_LANGUAGE: Language = 'en';
export const SUPPORTED_LANGUAGES: Language[] = [DEFAULT_PRIVATE_LANGUAGE, DEFAULT_GROUP_LANGUAGE];

const translations: Record<Locales, Translation> = {
    en,
    uk,
};

function validateTranslations(): void {
    const baseKeys = Object.keys(translations[DEFAULT_LANGUAGE]) as Array<keyof Translation>;

    for (const locale of Object.keys(translations) as Locales[]) {
        if (locale === DEFAULT_LANGUAGE) continue;

        const baseTranslation = translations[DEFAULT_LANGUAGE];
        const localeTranslation = translations[locale];

        for (const key of baseKeys) {
            const baseValue = baseTranslation[key];
            const localeValue = localeTranslation[key];

            if (typeof baseValue === 'object' && typeof localeValue === 'object') {
                const baseSubKeys = Object.keys(baseValue) as Array<string>;
                const localeSubKeys = Object.keys(localeValue as object) as Array<string>;
                const missing = baseSubKeys.filter(k => !localeSubKeys.includes(k));

                if (missing.length > 0) {
                    throw new Error(`Missing translations in ${locale}.${key}: ${missing.join(', ')}`);
                }
            }
        }
    }
}

validateTranslations();

const LOCALE_STRINGS: Record<Locales, string> = {
    en: 'en-US',
    uk: 'uk-UA'
};

const HOUR12_FORMAT: Record<Locales, boolean> = {
    en: true,
    uk: false
};

const CHART_LEFT_PADDING: Record<Locales, number> = {
    en: 60,
    uk: 90
};

export function getTranslations(locale: Locales): Translation {
    return translations[locale];
}

export function getLocaleString(lang: Language): string {
    return LOCALE_STRINGS[lang];
}

export function getHour12Format(lang: Language): boolean {
    return HOUR12_FORMAT[lang];
}

export function getChartLeftPadding(lang: Language): number {
    return CHART_LEFT_PADDING[lang];
}
