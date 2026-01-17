import {DEFAULT_LANGUAGE, formatDateTime, formatDurationSeconds, getTranslations, Language} from '../../utils';
import {RuntimeData} from '../../luxpower';

interface StatusTracker {
    currentStatus: boolean | null;
    currentDuration: number;
    statusChangeTime: Date | null;
    totalOnTime: number;
    totalOffTime: number;
    sessionDuration: number;
}

export class MessageFormatter {
    formatDuration(seconds: number, lang: Language): string {
        return formatDurationSeconds(seconds, lang);
    }

    formatInverterInfo(data: RuntimeData, stats: StatusTracker | null, lang: Language = DEFAULT_LANGUAGE): string {
        const t = getTranslations(lang);
        const vact = data.vact || 0;
        const vacr = data.vacr || 0;
        const gridVoltage = vacr > 0 ? (vacr / 10).toFixed(1) : (vact > 0 ? (vact / 10).toFixed(1) : '0.0');
        const powerToGrid = data.pToGrid || 0;
        const powerToUser = data.pToUser || 0;
        const batterySOC = data.soc || 0;
        const batteryVoltage = data.vBat ? (data.vBat / 10).toFixed(1) : '0.0';
        const batteryPower = data.batPower || 0;
        const pv1Voltage = data.vpv1 ? (data.vpv1 / 10).toFixed(1) : '0.0';
        const pv1Power = data.ppv1 || 0;
        const pv2Voltage = data.vpv2 ? (data.vpv2 / 10).toFixed(1) : '0.0';
        const pv2Power = data.ppv2 || 0;
        const pv3Voltage = data.vpv3 ? (data.vpv3 / 10).toFixed(1) : '0.0';
        const pv3Power = data.ppv3 || 0;
        const totalPVPower = pv1Power + pv2Power + pv3Power;
        const inverterPower = data.pinv || 0;
        const epsPower = data.peps || 0;
        const consumptionPower = data.consumptionPower || 0;
        const statusText = data.statusText || 'unknown';
        const deviceTimeRaw = data.deviceTime || 'N/A';

        const deviceTimeFormatted = deviceTimeRaw;

        const gridVoltageNum = parseFloat(gridVoltage);
        const gridFrequency = data.fac ? data.fac / 100 : 0;
        const hasElectricity = gridVoltageNum > 180 && gridFrequency > 45 && gridFrequency < 55;
        const electricityStatus = hasElectricity ? t.inverter.statusOn : t.inverter.statusOff;

        let batteryStatus: string;
        if (batteryPower > 0) {
            batteryStatus = t.inverter.batteryCharging;
        } else if (batteryPower < 0) {
            if (batterySOC >= 100 && Math.abs(batteryPower) < 20) {
                batteryStatus = t.inverter.batteryStandby;
            } else {
                batteryStatus = t.inverter.batteryDischarging;
            }
        } else {
            batteryStatus = t.inverter.batteryStandby;
        }

        let message = `${t.inverter.title}\n\n`;
        message += `${t.inverter.time} ${deviceTimeFormatted}\n`;
        message += `${t.inverter.systemStatus} ${statusText}\n`;

        if (stats && stats.currentDuration > 0) {
            message += `${t.inverter.currentState} ${this.formatDuration(stats.currentDuration, lang)}\n`;
        }
        message += `\n`;

        message += `${t.inverter.gridStatus}\n`;
        message += `   ${t.inverter.electricity} ${electricityStatus}\n`;
        message += `   ${t.inverter.voltage} ${gridVoltage} V\n`;
        message += `   ${t.inverter.consumption} ${consumptionPower} W\n`;
        message += `   ${t.inverter.grid} ${powerToUser} W\n`;
        message += `\n`;

        message += `${t.inverter.battery}\n`;
        message += `   ${t.inverter.batteryStatus} ${batteryStatus}\n`;
        message += `   ${t.inverter.soc} ${batterySOC}%\n`;
        message += `   ${t.inverter.voltage} ${batteryVoltage} V\n`;
        message += `   ${t.inverter.power} ${batteryPower} W\n\n`;

        if (totalPVPower > 0 || pv1Voltage !== '0.0' || pv2Voltage !== '0.0' || pv3Voltage !== '0.0') {
            message += `${t.inverter.solarInput}\n`;
            if (pv1Power > 0 || pv1Voltage !== '0.0') {
                message += `   ${t.inverter.pv1} ${pv1Power} W (${pv1Voltage} V)\n`;
            }
            if (pv2Power > 0 || pv2Voltage !== '0.0') {
                message += `   ${t.inverter.pv2} ${pv2Power} W (${pv2Voltage} V)\n`;
            }
            if (pv3Power > 0 || pv3Voltage !== '0.0') {
                message += `   ${t.inverter.pv3} ${pv3Power} W (${pv3Voltage} V)\n`;
            }
            message += `   ${t.inverter.total} ${totalPVPower} W\n\n`;
        }

        message += `${t.inverter.powerFlow}\n`;
        message += `   ${t.inverter.inverter} ${inverterPower} W\n`;
        if (epsPower > 0) {
            message += `   ${t.inverter.epsBackup} ${epsPower} W\n`;
        }

        return message;
    }

    formatStatusInfo(stats: StatusTracker | null, lang: Language = DEFAULT_LANGUAGE): string {
        const t = getTranslations(lang);
        let statusInfo = '';

        if (stats) {
            const statusText = stats.currentStatus === true ? t.inverter.statusOn : stats.currentStatus === false ? t.inverter.statusOff : t.inverter.statusUnknown;

            statusInfo += `${t.status.title}\n`;

            if (stats.statusChangeTime && stats.currentDuration >= 0) {
                const durationFormatted = this.formatDuration(stats.currentDuration, lang);
                statusInfo += `${t.status.current} ${statusText} (${durationFormatted})\n`;
                statusInfo += `${t.status.since} ${formatDateTime(stats.statusChangeTime, lang)}\n`;
            } else if (stats.statusChangeTime) {
                const durationFormatted = this.formatDuration(Math.abs(stats.currentDuration), lang);
                statusInfo += `${t.status.current} ${statusText} (${durationFormatted})\n`;
                statusInfo += `${t.status.since} ${formatDateTime(stats.statusChangeTime, lang)}\n`;
            } else {
                statusInfo += `${t.status.current} ${statusText}\n`;
            }

            if (stats.sessionDuration > 0) {
                statusInfo += `\n${t.status.sessionStats}\n`;
                statusInfo += `${t.status.totalOnTime} ${this.formatDuration(stats.totalOnTime, lang)}\n`;
                statusInfo += `${t.status.totalOffTime} ${this.formatDuration(stats.totalOffTime, lang)}\n`;
                statusInfo += `${t.status.sessionDuration} ${this.formatDuration(stats.sessionDuration, lang)}`;
            }
        } else {
            statusInfo = `${t.status.title}\n\n${t.status.notAvailable}`;
        }

        return statusInfo;
    }

    formatHelp(version: string, lang: Language = DEFAULT_LANGUAGE): string {
        const t = getTranslations(lang);
        return `${t.help.title}\n\n` +
            `${t.help.mainCommands}\n` +
            `${t.help.start}\n` +
            `${t.help.stop}\n` +
            `${t.help.menu}\n\n` +
            `${t.help.statusInfo}\n` +
            `${t.help.status}\n` +
            `${t.help.info}\n\n` +
            `${t.help.charts}\n` +
            `${t.help.chart}\n` +
            `${t.help.chartWeek}\n` +
            `${t.help.chartMonth}\n\n` +
            `${t.help.other}\n` +
            `${t.help.help}\n\n` +
            `${t.help.useButtons}\n\n` +
            `${t.help.autoNotify}\n\n` +
            `${t.help.version} ${version}`;
    }

}
