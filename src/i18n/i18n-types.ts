export type Locales = 'en' | 'uk';

export type Translation = {
    menu: {
        mainMenu: string;
        selectOption: string;
        version: string;
    };
    buttons: {
        inverterInfo: string;
        status: string;
        chart1Day: string;
        chart1Week: string;
        chart1Month: string;
        subscribe: string;
        unsubscribe: string;
        help: string;
        refresh: string;
        mainMenu: string;
        chart1DayFull: string;
        chart1WeekFull: string;
        language: string;
    };
    notifications: {
        electricityAppeared: string;
        electricityDisappeared: string;
        wasOffFor: string;
        wasOnFor: string;
        gridPower: string;
        time: string;
        useInfo: string;
    };
    inverter: {
        title: string;
        time: string;
        systemStatus: string;
        currentState: string;
        gridStatus: string;
        electricity: string;
        voltage: string;
        consumption: string;
        grid: string;
        battery: string;
        batteryStatus: string;
        soc: string;
        power: string;
        solarInput: string;
        pv1: string;
        pv2: string;
        pv3: string;
        total: string;
        powerFlow: string;
        inverter: string;
        epsBackup: string;
        statusOn: string;
        statusOff: string;
        statusUnknown: string;
        batteryCharging: string;
        batteryDischarging: string;
        batteryStandby: string;
    };
    status: {
        title: string;
        current: string;
        since: string;
        sessionStats: string;
        totalOnTime: string;
        totalOffTime: string;
        sessionDuration: string;
        notAvailable: string;
    };
    charts: {
        generating: string;
        title: string;
        chartTitle: string;
        chartOnLabel: string;
        chartOffLabel: string;
        greenOn: string;
        redOff: string;
        noData: string;
        notAvailable: string;
        error: string;
        selectTimeRange: string;
        last24Hours: string;
        last7Days: string;
        last30Days: string;
        period1Day: string;
        period1Week: string;
        period1Month: string;
        periodHours: string;
    };
    duration: {
        days: string;
        hours: string;
        minutes: string;
        seconds: string;
    };
    subscribe: {
        subscribed: string;
        willReceive: string;
        useButtons: string;
        alreadySubscribed: string;
        unsubscribed: string;
        noLongerReceive: string;
        useStart: string;
        notSubscribed: string;
        groupSubscribed: string;
        groupAlreadySubscribed: string;
        groupUnsubscribed: string;
        groupJoke: string;
    };
    help: {
        title: string;
        mainCommands: string;
        start: string;
        stop: string;
        menu: string;
        statusInfo: string;
        status: string;
        info: string;
        charts: string;
        chart: string;
        chartWeek: string;
        chartMonth: string;
        other: string;
        help: string;
        useButtons: string;
        autoNotify: string;
        version: string;
    };
    errors: {
        inverterNotAvailable: string;
        chartNotAvailable: string;
        errorFetching: string;
        errorGenerating: string;
    };
    language: {
        changed: string;
        current: string;
        select: string;
    };
    group: {
        readonlyMessage: string;
        electricityAppeared: string;
        electricityDisappeared: string;
    };
};
