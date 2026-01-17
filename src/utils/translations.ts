import type { Locales, Translation } from '../i18n/i18n-types';
import en from '../i18n/en/index';
import uk from '../i18n/uk/index';

export type Language = Locales;

const translations: Record<Locales, Translation> = {
  en,
  uk,
};

function validateTranslations(): void {
  const baseKeys = Object.keys(translations.en) as Array<keyof Translation>;
  
  for (const locale of Object.keys(translations) as Locales[]) {
    if (locale === 'en') continue;
    
    const baseTranslation = translations.en;
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

export function getTranslations(locale: Locales = 'en'): Translation {
  return translations[locale];
}

export function formatDateTime(date: Date, lang: Language = 'en'): string {
  if (lang === 'uk') {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
  } else {
    return date.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }
}
