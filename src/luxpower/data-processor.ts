import {ElectricityStatus, HistoryPoint, RuntimeData} from './types';

export class LuxpowerDataProcessor {
    processRuntimeData(data: RuntimeData): ElectricityStatus {
        const vacr = data.vacr || 0;
        const vact = data.vact || 0;

        const gridVoltage = vacr > 0 ? (vacr / 10).toFixed(1) : (vact > 0 ? (vact / 10).toFixed(1) : '0.0');
        const gridVoltageNum = parseFloat(gridVoltage);
        const gridFrequency = data.fac ? data.fac / 100 : 0;
        const powerToGrid = data.pToGrid || 0;
        const powerToUser = data.pToUser || 0;

        const hasElectricity = gridVoltageNum > 160 && gridFrequency > 45 && gridFrequency < 55;

        let gridPower = 0;
        if (powerToGrid > 0) {
            gridPower = powerToGrid;
        } else if (powerToUser > 0) {
            gridPower = -powerToUser;
        } else if (powerToGrid < 0) {
            gridPower = powerToGrid;
        } else if (powerToUser < 0) {
            gridPower = -powerToUser;
        }

        return {
            hasElectricity,
            gridPower,
            timestamp: new Date().toISOString(),
            rawData: data
        };
    }

    processHistoryPoint(point: any): HistoryPoint | null {
        const vacr = parseFloat(point.vacr) || 0;
        const hasElectricity = vacr > 0;

        let timestamp = point.time || new Date().toISOString();
        let pointDate: Date;

        if (typeof timestamp === 'string') {
            if (timestamp.includes('T') && timestamp.endsWith('Z')) {
                pointDate = new Date(timestamp);
            } else if (timestamp.includes('T')) {
                pointDate = new Date(timestamp);
            } else {
                const localTimestamp = timestamp.replace(' ', 'T');
                pointDate = new Date(localTimestamp);
            }
        } else {
            pointDate = new Date(timestamp);
        }

        return {
            timestamp: pointDate.toISOString(),
            hasElectricity
        };
    }
}
