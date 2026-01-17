import type { Translation } from '../i18n-types';

const en: Translation = {
  menu: {
    mainMenu: '🏠 Main Menu',
    selectOption: 'Select an option:',
    version: 'Version:'
  },
  buttons: {
    inverterInfo: '📊 Inverter Info',
    status: '📈 Status',
    chart1Day: '📉 1 Day',
    chart1Week: '📉 1 Week',
    chart1Month: '📉 1 Month',
    subscribe: '✅ Subscribe',
    unsubscribe: '❌ Unsubscribe',
    help: 'ℹ️ Help',
    refresh: '🔄 Refresh',
    mainMenu: '🏠 Main Menu',
    chart1DayFull: '📉 1 Day Chart',
    chart1WeekFull: '📉 1 Week Chart',
    language: '🌐 Language'
  },
  notifications: {
    electricityAppeared: '⚡ <b>Electricity Appeared!</b>\n\nHooray! The lights are back! 🎉',
    electricityDisappeared: '🔌 <b>Electricity Disappeared!</b>\n\nOh no! The lights went out! 😞',
    wasOffFor: '\n⏱️ Was off for:',
    wasOnFor: '\n⏱️ Was on for:',
    gridPower: 'Grid Power:',
    time: 'Time:',
    useInfo: 'Use /info to see full inverter status.'
  },
  inverter: {
    title: '⚡ Inverter Status',
    time: '📅 Time:',
    systemStatus: '🔄 System Status:',
    currentState: '⏱️ Current state:',
    gridStatus: '🔌 Grid Status',
    electricity: 'Electricity:',
    voltage: 'Voltage:',
    consumption: 'Consumption:',
    grid: 'GRID:',
    battery: '🔋 Battery',
    batteryStatus: 'Status:',
    soc: 'SOC:',
    power: 'Power:',
    solarInput: '☀️ Solar Input',
    pv1: 'PV1:',
    pv2: 'PV2:',
    pv3: 'PV3:',
    total: 'Total:',
    powerFlow: '⚙️ Power Flow',
    inverter: 'Inverter:',
    epsBackup: 'EPS Backup:',
    statusOn: '🟢 ON',
    statusOff: '🔴 OFF',
    statusUnknown: '⚪ Unknown',
    batteryCharging: '🔋 Charging',
    batteryDischarging: '⚡ Discharging',
    batteryStandby: '⚪ Standby'
  },
  status: {
    title: '⚡ Electricity Status',
    current: 'Current:',
    since: 'Since:',
    sessionStats: '📈 Session Stats (since service start)',
    totalOnTime: 'Total ON time:',
    totalOffTime: 'Total OFF time:',
    sessionDuration: 'Session duration:',
    notAvailable: 'Status tracking is not available.'
  },
  charts: {
    generating: '📊 Generating chart for',
    title: '📊 <b>Electricity Status History</b>',
    greenOn: '🟢 Green = ON',
    redOff: '🔴 Red = OFF',
    noData: '❌ No history data available for',
    notAvailable: '❌ Chart generation is not available. The service may not be fully configured.',
    error: '❌ Error generating chart:',
    selectTimeRange: 'Select a time range:',
    last24Hours: 'Last 24 Hours',
    last7Days: 'Last 7 Days',
    last30Days: 'Last 30 Days',
    period1Day: '1 Day',
    period1Week: '1 Week',
    period1Month: '1 Month',
    periodHours: 'hours'
  },
  subscribe: {
    subscribed: '✅ <b>Subscribed!</b>',
    willReceive: 'You will now receive electricity status notifications.',
    useButtons: 'Use the buttons below to interact with the bot.',
    alreadySubscribed: 'You are already subscribed! Use the buttons below to interact with the bot.',
    unsubscribed: '❌ <b>Unsubscribed</b>',
    noLongerReceive: 'You will no longer receive notifications.',
    useStart: 'Use /start to subscribe again.',
    notSubscribed: 'You are not subscribed. Use /start to subscribe.',
    groupSubscribed: '✅ <b>Group subscribed!</b>\n\nThis bot will now notify this group about power outages.',
    groupAlreadySubscribed: '✅ This group is already subscribed to power outage notifications.',
    groupUnsubscribed: '❌ <b>Group unsubscribed</b>\n\nThis group will no longer receive power outage notifications.\n\n💡 You can subscribe again at any time by sending /start.',
    groupJoke: '💡 <i>P.S. Don\'t worry if the lights go out - the bot will stay connected! It runs on batteries... oh wait, it runs on a server 😄</i>'
  },
  help: {
    title: '📖 Available Commands',
    mainCommands: '<b>Main Commands:</b>',
    start: '/start - Subscribe to notifications',
    stop: '/stop - Unsubscribe from notifications',
    menu: '/menu - Show main menu with buttons',
    statusInfo: '<b>Status & Info:</b>',
    status: '/status - Check electricity status and statistics',
    info: '/info or /inverter - Get detailed inverter information',
    charts: '<b>Charts:</b>',
    chart: '/chart or /chart_day - View 1 day chart',
    chartWeek: '/chart_week - View 1 week chart',
    chartMonth: '/chart_month - View 1 month chart',
    other: '<b>Other:</b>',
    help: '/help - Show this help message',
    useButtons: 'You can also use the buttons in the menu for quick access.',
    autoNotify: 'The bot will automatically notify you when electricity appears or disappears.',
    version: '📦 <b>Version:</b>'
  },
  errors: {
    inverterNotAvailable: '❌ Inverter information is not available. The service may not be fully configured.',
    chartNotAvailable: '❌ Chart generation is not available. The service may not be fully configured.',
    errorFetching: '❌ Error fetching inverter information:',
    errorGenerating: '❌ Error generating chart:'
  },
  language: {
    changed: '🌐 Language changed to',
    current: 'Current language:',
    select: 'Select language:'
  },
  group: {
    readonlyMessage: '🔇 This bot is read-only in groups.\n\n📊 To view charts, history, and use commands, please subscribe to the bot personally by sending /start in a private chat.',
    electricityAppeared: '⚡ <b>Lights Appeared!</b> Hooray! The lights are back! 🎉',
    electricityDisappeared: '🔌 <b>Lights Disappeared!</b> Oh no! The lights went out! 😞'
  }
};

export default en;
