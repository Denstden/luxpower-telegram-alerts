import {HistoryPoint} from '../luxpower/types';

export interface Statistics {
    onTime: number;
    offTime: number;
    onPercent: string;
    offPercent: string;
}

export class StatisticsCalculator {
    static calculate(points: HistoryPoint[], hasSyntheticNowPoint: boolean): Statistics {
        const pointsForStats = hasSyntheticNowPoint ? points.slice(0, -1) : points;
        let onTime = 0;
        let offTime = 0;

        for (let i = 0; i < pointsForStats.length - 1; i++) {
            const currentTime = new Date(pointsForStats[i].timestamp).getTime();
            const nextTime = new Date(pointsForStats[i + 1].timestamp).getTime();
            const duration = nextTime - currentTime;

            if (pointsForStats[i].hasElectricity) {
                onTime += duration;
            } else {
                offTime += duration;
            }
        }

        if (pointsForStats.length > 0) {
            const lastPointTime = new Date(pointsForStats[pointsForStats.length - 1].timestamp).getTime();
            const timeUntilNow = Date.now() - lastPointTime;
            if (pointsForStats[pointsForStats.length - 1].hasElectricity) {
                onTime += timeUntilNow;
            } else {
                offTime += timeUntilNow;
            }
        }

        const totalTime = onTime + offTime;
        const onPercent = totalTime > 0 ? ((onTime / totalTime) * 100).toFixed(1) : '0.0';
        const offPercent = totalTime > 0 ? ((offTime / totalTime) * 100).toFixed(1) : '0.0';

        return {onTime, offTime, onPercent, offPercent};
    }
}
