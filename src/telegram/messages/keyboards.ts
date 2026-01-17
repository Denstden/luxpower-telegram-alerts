import { getTranslations, Language } from '../../utils';

export class KeyboardBuilder {
  getMainMenu(chatId: string, isSubscribed: boolean, lang: Language = 'en'): any {
    const t = getTranslations(lang);
    const subscribeButton = isSubscribed
        ? [{text: t.buttons.unsubscribe, callback_data: 'unsubscribe'}]
        : [{text: t.buttons.subscribe, callback_data: 'subscribe'}];

    return {
      inline_keyboard: [
        [
          {text: t.buttons.inverterInfo, callback_data: 'info'},
          {text: t.buttons.status, callback_data: 'status'}
        ],
        [
          {text: t.buttons.chart1Day, callback_data: 'chart_24'},
          {text: t.buttons.chart1Week, callback_data: 'chart_168'},
          {text: t.buttons.chart1Month, callback_data: 'chart_720'}
        ],
        subscribeButton,
        [
          {text: t.buttons.help, callback_data: 'help'},
          {text: t.buttons.language, callback_data: 'language'}
        ]
      ]
    };
  }

  getInverterInfoKeyboard(lang: Language = 'en'): any {
    const t = getTranslations(lang);
    return {
      inline_keyboard: [
        [{text: t.buttons.refresh, callback_data: 'info'}],
        [{text: t.buttons.mainMenu, callback_data: 'menu'}]
      ]
    };
  }

  getNotificationKeyboard(lang: Language = 'en'): any {
    const t = getTranslations(lang);
    return {
      inline_keyboard: [
        [
          {text: t.buttons.inverterInfo, callback_data: 'info'},
          {text: t.buttons.status, callback_data: 'status'}
        ],
        [
          {text: t.buttons.chart1DayFull, callback_data: 'chart_24'},
          {text: t.buttons.chart1WeekFull, callback_data: 'chart_168'}
        ],
        [
          {text: t.buttons.mainMenu, callback_data: 'menu'}
        ]
      ]
    };
  }

  getChartKeyboard(hours: number, lang: Language = 'en'): any {
    const t = getTranslations(lang);
    return {
      inline_keyboard: [
        [
          {text: t.buttons.refresh, callback_data: `chart_${hours}`},
          {text: t.buttons.chart1Day, callback_data: 'chart_24'},
          {text: t.buttons.chart1Week, callback_data: 'chart_168'},
          {text: t.buttons.chart1Month, callback_data: 'chart_720'}
        ],
        [
          {text: t.buttons.mainMenu, callback_data: 'menu'}
        ]
      ]
    };
  }

  getLanguageKeyboard(currentLang: Language, lang: Language = 'en'): any {
    const t = getTranslations(lang);
    return {
      inline_keyboard: [
        [
          {text: `🇺🇦 Українсьka${currentLang === 'uk' ? ' ✓' : ''}`, callback_data: 'lang_uk'},
          {text: `🇬🇧 English${currentLang === 'en' ? ' ✓' : ''}`, callback_data: 'lang_en'}
        ],
        [
          {text: t.buttons.mainMenu, callback_data: 'menu'}
        ]
      ]
    };
  }
}
