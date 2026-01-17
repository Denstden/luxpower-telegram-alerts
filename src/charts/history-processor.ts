import {HistoryPoint} from '../luxpower/types';

export interface TimeRange {
    minTime: number;
    maxTime: number;
    timeRange: number;
}

export class HistoryProcessor {
    static calculateTimeRange(historyPoints: HistoryPoint[]): TimeRange {
        const timestamps = historyPoints.map(p => new Date(p.timestamp).getTime());
        let minTime = timestamps[0];
        let maxTime = timestamps[0];

        for (let i = 1; i < timestamps.length; i++) {
            if (timestamps[i] < minTime) minTime = timestamps[i];
            if (timestamps[i] > maxTime) maxTime = timestamps[i];
        }

        const now = Date.now();
        if (now > maxTime) {
            maxTime = now;
        }

        return {
            minTime,
            maxTime,
            timeRange: maxTime - minTime
        };
    }

    static mergeHistoryPoints(historyPoints: HistoryPoint[]): HistoryPoint[] {
        const sortedPoints = [...historyPoints].sort((a, b) => {
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });

        const mergedPoints: HistoryPoint[] = [];
        let lastStatus: boolean | null = null;

        for (let i = 0; i < sortedPoints.length; i++) {
            const point = sortedPoints[i];
            const isFirst = i === 0;
            const isLast = i === sortedPoints.length - 1;

            if (isFirst || isLast || point.hasElectricity !== lastStatus) {
                mergedPoints.push(point);
                lastStatus = point.hasElectricity;
            }
        }

        return mergedPoints;
    }

    static addSyntheticNowPoint(points: HistoryPoint[]): { points: HistoryPoint[]; hasSyntheticNowPoint: boolean } {
        const now = Date.now();
        if (points.length === 0) {
            return {points, hasSyntheticNowPoint: false};
        }

        const lastPoint = points[points.length - 1];
        const lastPointTime = new Date(lastPoint.timestamp).getTime();

        if (now > lastPointTime) {
            return {
                points: [
                    ...points,
                    {
                        timestamp: new Date(now).toISOString(),
                        hasElectricity: lastPoint.hasElectricity
                    }
                ],
                hasSyntheticNowPoint: true
            };
        }

        return {points, hasSyntheticNowPoint: false};
    }
}
