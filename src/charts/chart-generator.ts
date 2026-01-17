import {Resvg} from '@resvg/resvg-js';
import * as fs from 'fs';
import {getTranslations, Language} from '../utils';

interface HistoryPoint {
    timestamp: string;
    hasElectricity: boolean;
}

export class ChartGenerator {
    private generateSVG(historyPoints: HistoryPoint[], period: 'day' | 'week' | 'month', lang: Language = 'en'): string {
        const t = getTranslations(lang);
        const periodLabels = {
            day: t.charts.last24Hours,
            week: t.charts.last7Days,
            month: t.charts.last30Days
        };

        const width = 800;
        const height = 400;
        const leftPadding = lang === 'uk' ? 90 : 60;
        const rightPadding = 60;
        const topPadding = 60;
        const bottomPadding = 60;
        const chartWidth = width - leftPadding - rightPadding;
        const chartHeight = height - topPadding - bottomPadding;

        if (historyPoints.length === 0) {
            return '';
        }

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
        const timeRange = maxTime - minTime;

        const getXPosition = (timestamp: string): number => {
            const pointTime = new Date(timestamp).getTime();
            if (timeRange === 0) {
                return leftPadding + chartWidth / 2;
            }
            const ratio = (pointTime - minTime) / timeRange;
            return leftPadding + (ratio * chartWidth);
        };

        const onColor = '#4ade80';
        const offColor = '#ef4444';
        const bgColor = '#1a1a1a';
        const gridColor = '#374151';
        const textColor = '#ffffff';

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

        const finalPoints = mergedPoints;
        let hasSyntheticNowPoint = false;
        if (finalPoints.length > 0) {
            const lastPoint = finalPoints[finalPoints.length - 1];
            const lastPointTime = new Date(lastPoint.timestamp).getTime();
            if (now > lastPointTime) {
                finalPoints.push({
                    timestamp: new Date(now).toISOString(),
                    hasElectricity: lastPoint.hasElectricity
                });
                hasSyntheticNowPoint = true;
            }
        }

        const pointsToDraw = hasSyntheticNowPoint ? finalPoints.length - 1 : finalPoints.length;

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="${width}" height="${height}" fill="${bgColor}"/>`;

        const title = lang === 'uk' ? 'Історія статусу електрики' : 'Electricity Status History';
        svg += `<text x="${width / 2}" y="30" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="18" font-weight="bold">${title} - ${periodLabels[period]}</text>`;

        for (let i = 0; i <= 10; i++) {
            const y = topPadding + (chartHeight / 10) * i;
            svg += `<line x1="${leftPadding}" y1="${y}" x2="${width - rightPadding}" y2="${y}" stroke="${gridColor}" stroke-width="1" opacity="0.3"/>`;
        }

        svg += `<line x1="${leftPadding}" y1="${height - bottomPadding}" x2="${width - rightPadding}" y2="${height - bottomPadding}" stroke="${textColor}" stroke-width="2"/>`;

        const onY = topPadding + chartHeight * 0.1;
        const offY = topPadding + chartHeight * 0.9;

        const onLabelY = lang === 'uk' ? 'Є світло' : 'ON';
        const offLabelY = lang === 'uk' ? 'Нема світла' : 'OFF';
        svg += `<text x="${leftPadding - 10}" y="${onY + 5}" text-anchor="end" fill="${onColor}" font-family="sans-serif" font-size="12">${onLabelY}</text>`;
        svg += `<text x="${leftPadding - 10}" y="${offY + 5}" text-anchor="end" fill="${offColor}" font-family="sans-serif" font-size="12">${offLabelY}</text>`;

        for (let i = 0; i < pointsToDraw - 1; i++) {
            const x1 = getXPosition(finalPoints[i].timestamp);
            const x2 = getXPosition(finalPoints[i + 1].timestamp);
            const y = finalPoints[i].hasElectricity ? onY : offY;
            const color = finalPoints[i].hasElectricity ? onColor : offColor;

            svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
        }

        if (pointsToDraw > 0) {
            const lastX = getXPosition(finalPoints[pointsToDraw - 1].timestamp);
            const lastY = finalPoints[pointsToDraw - 1].hasElectricity ? onY : offY;
            const lastColor = finalPoints[pointsToDraw - 1].hasElectricity ? onColor : offColor;
            svg += `<line x1="${lastX}" y1="${lastY}" x2="${width - rightPadding}" y2="${lastY}" stroke="${lastColor}" stroke-width="5" stroke-linecap="round"/>`;
        }

        const formatTime = (date: Date, showDate: boolean = false): string => {
            const hours = date.getHours();
            const minutes = date.getMinutes();

            if (showDate) {
                const day = date.getDate();
                const month = date.getMonth() + 1;
                if (lang === 'uk') {
                    return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                } else {
                    const monthName = date.toLocaleDateString('en-US', {month: 'short'});
                    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                    const ampm = hours < 12 ? 'AM' : 'PM';
                    return `${monthName} ${day} ${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                }
            }

            if (lang === 'uk') {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            } else {
                const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                const ampm = hours < 12 ? 'AM' : 'PM';
                return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
            }
        };

        const formatDuration = (milliseconds: number): string => {
            const totalSeconds = Math.floor(milliseconds / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            const parts: string[] = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);
            if (seconds > 0 && parts.length === 0) parts.push(`${seconds}s`);

            return parts.length > 0 ? parts.join(' ') : '0s';
        };

        if (period === 'day') {
            for (let i = 0; i < pointsToDraw - 1; i++) {
                const segmentStart = finalPoints[i];
                const segmentEnd = finalPoints[i + 1];
                const hasElectricity = segmentStart.hasElectricity;

                const startX = getXPosition(segmentStart.timestamp);
                const endX = getXPosition(segmentEnd.timestamp);
                const y = hasElectricity ? onY : offY;

                const startDate = new Date(segmentStart.timestamp);
                const endDate = new Date(segmentEnd.timestamp);

                const startLabel = formatTime(startDate);
                const endLabel = formatTime(endDate);

                const labelYAbove = y - 15;
                const labelYBelow = y + 20;
                const midX = (startX + endX) / 2;

                svg += `<text x="${startX}" y="${labelYAbove}" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="9" opacity="0.9">${startLabel}</text>`;
                svg += `<text x="${endX}" y="${labelYAbove}" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="9" opacity="0.9">${endLabel}</text>`;

                const duration = endDate.getTime() - startDate.getTime();
                const durationLabel = formatDuration(duration);
                svg += `<text x="${midX}" y="${labelYBelow}" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="9" opacity="0.9">${durationLabel}</text>`;
            }

            if (pointsToDraw > 0) {
                const firstPoint = finalPoints[0];
                const firstX = getXPosition(firstPoint.timestamp);
                const firstY = firstPoint.hasElectricity ? onY : offY;
                const firstLabel = formatTime(new Date(firstPoint.timestamp));

                svg += `<text x="${firstX}" y="${firstY - 15}" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="9" opacity="0.9">${firstLabel}</text>`;
            }

            if (pointsToDraw > 0) {
                const lastPoint = finalPoints[pointsToDraw - 1];
                const lastX = getXPosition(lastPoint.timestamp);
                const lastY = lastPoint.hasElectricity ? onY : offY;
                const lastLabel = formatTime(new Date(lastPoint.timestamp));

                svg += `<text x="${lastX}" y="${lastY - 15}" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="9" opacity="0.9">${lastLabel}</text>`;
            }
        }


        const numLabels = 8;
        const labels: Array<{ x: number, label: string }> = [];

        for (let i = 0; i < numLabels; i++) {
            const ratio = i / (numLabels - 1);
            const labelTime = minTime + (ratio * timeRange);
            const date = new Date(labelTime);
            let label = '';

            if (period === 'day') {
                label = formatTime(date);
            } else {
                const day = date.getDate();
                const month = date.getMonth() + 1;
                if (lang === 'uk') {
                    label = `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}`;
                } else {
                    const monthName = date.toLocaleDateString('en-US', {month: 'short'});
                    label = `${monthName} ${day}`;
                }
            }

            let x = leftPadding + (ratio * chartWidth);
            if (i === 0) {
                x = leftPadding + 20;
            }
            labels.push({x, label});
        }

        for (const {x, label} of labels) {
            svg += `<text x="${x}" y="${height - bottomPadding + 20}" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="10" transform="rotate(-45 ${x} ${height - bottomPadding + 20})">${label}</text>`;
        }

        let onTime = 0;
        let offTime = 0;

        const pointsForStats = hasSyntheticNowPoint ? finalPoints.slice(0, -1) : finalPoints;

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

        const onLabelStats = lang === 'uk' ? 'Є світло' : 'ON';
        const offLabelStats = lang === 'uk' ? 'Нема світла' : 'OFF';
        svg += `<text x="${width - rightPadding}" y="${topPadding - 10}" text-anchor="end" fill="${textColor}" font-family="sans-serif" font-size="12">${onLabelStats}: ${onPercent}%</text>`;
        svg += `<text x="${width - rightPadding}" y="${topPadding + 5}" text-anchor="end" fill="${textColor}" font-family="sans-serif" font-size="12">${offLabelStats}: ${offPercent}%</text>`;

        svg += `</svg>`;
        return svg;
    }

    async generateChart(historyPoints: HistoryPoint[], period: 'day' | 'week' | 'month', lang: Language = 'en'): Promise<Buffer> {
        if (historyPoints.length === 0) {
            throw new Error('No history data available');
        }

        const svg = this.generateSVG(historyPoints, period, lang);
        const fontFiles: string[] = [];
        const possibleFontPaths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/TTF/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans.ttf',
            '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
            '/System/Library/Fonts/Helvetica.ttc'
        ];

        for (const fontPath of possibleFontPaths) {
            try {
                if (fs.existsSync(fontPath)) {
                    fontFiles.push(fontPath);
                    break;
                }
            } catch (e) {
                // Continue to next path
            }
        }

        const resvg = new Resvg(svg, {
            background: '#1a1a1a',
            fitTo: {
                mode: 'width',
                value: 800
            },
            font: {
                loadSystemFonts: fontFiles.length === 0,
                fontFiles: fontFiles.length > 0 ? fontFiles : undefined,
                defaultFontFamily: 'sans-serif'
            }
        });
        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();

        return Buffer.from(pngBuffer);
    }

    async generateTimelineChart(historyPoints: HistoryPoint[], hours: number, lang: Language = 'en'): Promise<Buffer> {
        if (historyPoints.length === 0) {
            throw new Error(`No history data available`);
        }

        const now = new Date();
        const requestedStartTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));

        const filteredPoints = historyPoints.filter(p => {
            const pointTime = new Date(p.timestamp);
            return pointTime >= requestedStartTime;
        });

        if (filteredPoints.length === 0) {
            throw new Error(`No data available for the last ${hours} hours`);
        }

        let period: 'day' | 'week' | 'month' = 'day';
        if (hours >= 24 * 30) {
            period = 'month';
        } else if (hours >= 24 * 7) {
            period = 'week';
        }

        return this.generateChart(filteredPoints, period, lang);
    }
}
