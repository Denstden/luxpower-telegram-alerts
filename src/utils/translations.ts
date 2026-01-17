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
