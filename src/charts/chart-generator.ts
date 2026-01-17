import {Resvg} from '@resvg/resvg-js';
import {DEFAULT_LANGUAGE, formatDate, formatDuration, formatTime, getTranslations, Language} from '../utils';
import {HistoryPoint} from '../luxpower';
import {ChartColors} from './types';
import {ChartConfigBuilder} from './config';
import {HistoryProcessor} from './history-processor';
import {StatisticsCalculator} from './statistics';
import {FontFinder} from './font-finder';

export class ChartGenerator {
    private readonly colors: ChartColors = {
        onColor: '#4ade80',
        offColor: '#ef4444',
        bgColor: '#1a1a1a',
        gridColor: '#374151',
        textColor: '#ffffff'
    };

    private generateSVG(historyPoints: HistoryPoint[], period: 'day' | 'week' | 'month', lang: Language = DEFAULT_LANGUAGE): string {
        const t = getTranslations(lang);
        const config = ChartConfigBuilder.build(lang);
        const {minTime, maxTime, timeRange} = HistoryProcessor.calculateTimeRange(historyPoints);

        const getXPosition = (timestamp: string): number => {
            const pointTime = new Date(timestamp).getTime();
            if (timeRange === 0) {
                return config.leftPadding + config.chartWidth / 2;
            }
            const ratio = (pointTime - minTime) / timeRange;
            return config.leftPadding + (ratio * config.chartWidth);
        };

        const mergedPoints = HistoryProcessor.mergeHistoryPoints(historyPoints);
        const {points: finalPoints, hasSyntheticNowPoint} = HistoryProcessor.addSyntheticNowPoint(mergedPoints);
        const pointsToDraw = hasSyntheticNowPoint ? finalPoints.length - 1 : finalPoints.length;

        let svg = `<svg width="${config.width}" height="${config.height}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="${config.width}" height="${config.height}" fill="${this.colors.bgColor}"/>`;

        const periodLabels = {
            day: t.charts.last24Hours,
            week: t.charts.last7Days,
            month: t.charts.last30Days
        };

        svg += `<text x="${config.width / 2}" y="30" text-anchor="middle" fill="${this.colors.textColor}" font-family="sans-serif" font-size="18" font-weight="bold">${t.charts.chartTitle} - ${periodLabels[period]}</text>`;

        for (let i = 0; i <= 10; i++) {
            const y = config.topPadding + (config.chartHeight / 10) * i;
            svg += `<line x1="${config.leftPadding}" y1="${y}" x2="${config.width - config.rightPadding}" y2="${y}" stroke="${this.colors.gridColor}" stroke-width="1" opacity="0.3"/>`;
        }

        svg += `<line x1="${config.leftPadding}" y1="${config.height - config.bottomPadding}" x2="${config.width - config.rightPadding}" y2="${config.height - config.bottomPadding}" stroke="${this.colors.textColor}" stroke-width="2"/>`;

        const onY = config.topPadding + config.chartHeight * 0.1;
        const offY = config.topPadding + config.chartHeight * 0.9;

        svg += `<text x="${config.leftPadding - 10}" y="${onY + 5}" text-anchor="end" fill="${this.colors.onColor}" font-family="sans-serif" font-size="12">${t.charts.chartOnLabel}</text>`;
        svg += `<text x="${config.leftPadding - 10}" y="${offY + 5}" text-anchor="end" fill="${this.colors.offColor}" font-family="sans-serif" font-size="12">${t.charts.chartOffLabel}</text>`;

        for (let i = 0; i < pointsToDraw - 1; i++) {
            const x1 = getXPosition(finalPoints[i].timestamp);
            const x2 = getXPosition(finalPoints[i + 1].timestamp);
            const y = finalPoints[i].hasElectricity ? onY : offY;
            const color = finalPoints[i].hasElectricity ? this.colors.onColor : this.colors.offColor;

            svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
        }

        if (pointsToDraw > 0) {
            const lastX = getXPosition(finalPoints[pointsToDraw - 1].timestamp);
            const lastY = finalPoints[pointsToDraw - 1].hasElectricity ? onY : offY;
            const lastColor = finalPoints[pointsToDraw - 1].hasElectricity ? this.colors.onColor : this.colors.offColor;
            svg += `<line x1="${lastX}" y1="${lastY}" x2="${config.width - config.rightPadding}" y2="${lastY}" stroke="${lastColor}" stroke-width="5" stroke-linecap="round"/>`;
        }

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

                const startLabel = formatTime(startDate, lang);
                const endLabel = formatTime(endDate, lang);

                const labelYAbove = y - 15;
                const labelYBelow = y + 20;
                const midX = (startX + endX) / 2;

                svg += `<text x="${startX}" y="${labelYAbove}" text-anchor="middle" fill="${this.colors.textColor}" font-family="sans-serif" font-size="9" opacity="0.9">${startLabel}</text>`;
                svg += `<text x="${endX}" y="${labelYAbove}" text-anchor="middle" fill="${this.colors.textColor}" font-family="sans-serif" font-size="9" opacity="0.9">${endLabel}</text>`;

                const duration = endDate.getTime() - startDate.getTime();
                const durationLabel = formatDuration(duration, lang);
                svg += `<text x="${midX}" y="${labelYBelow}" text-anchor="middle" fill="${this.colors.textColor}" font-family="sans-serif" font-size="9" opacity="0.9">${durationLabel}</text>`;
            }

            if (pointsToDraw > 0) {
                const firstPoint = finalPoints[0];
                const firstX = getXPosition(firstPoint.timestamp);
                const firstY = firstPoint.hasElectricity ? onY : offY;
                const firstLabel = formatTime(new Date(firstPoint.timestamp), lang);

                svg += `<text x="${firstX}" y="${firstY - 15}" text-anchor="middle" fill="${this.colors.textColor}" font-family="sans-serif" font-size="9" opacity="0.9">${firstLabel}</text>`;
            }

            if (pointsToDraw > 0) {
                const lastPoint = finalPoints[pointsToDraw - 1];
                const lastX = getXPosition(lastPoint.timestamp);
                const lastY = lastPoint.hasElectricity ? onY : offY;
                const lastLabel = formatTime(new Date(lastPoint.timestamp), lang);

                svg += `<text x="${lastX}" y="${lastY - 15}" text-anchor="middle" fill="${this.colors.textColor}" font-family="sans-serif" font-size="9" opacity="0.9">${lastLabel}</text>`;
            }
        }

        const numLabels = 8;
        const labels: Array<{ x: number; label: string }> = [];

        for (let i = 0; i < numLabels; i++) {
            const ratio = i / (numLabels - 1);
            const labelTime = minTime + (ratio * timeRange);
            const date = new Date(labelTime);
            const label = period === 'day' ? formatTime(date, lang) : formatDate(date, lang);

            let x = config.leftPadding + (ratio * config.chartWidth);
            if (i === 0) {
                x = config.leftPadding + 20;
            }
            labels.push({x, label});
        }

        for (const {x, label} of labels) {
            svg += `<text x="${x}" y="${config.height - config.bottomPadding + 20}" text-anchor="middle" fill="${this.colors.textColor}" font-family="sans-serif" font-size="10" transform="rotate(-45 ${x} ${config.height - config.bottomPadding + 20})">${label}</text>`;
        }

        const {onPercent, offPercent} = StatisticsCalculator.calculate(finalPoints, hasSyntheticNowPoint);
        svg += `<text x="${config.width - config.rightPadding}" y="${config.topPadding - 10}" text-anchor="end" fill="${this.colors.textColor}" font-family="sans-serif" font-size="12">${t.charts.chartOnLabel}: ${onPercent}%</text>`;
        svg += `<text x="${config.width - config.rightPadding}" y="${config.topPadding + 5}" text-anchor="end" fill="${this.colors.textColor}" font-family="sans-serif" font-size="12">${t.charts.chartOffLabel}: ${offPercent}%</text>`;

        svg += `</svg>`;
        return svg;
    }

    async generateChart(historyPoints: HistoryPoint[], period: 'day' | 'week' | 'month', lang: Language = DEFAULT_LANGUAGE): Promise<Buffer> {
        if (historyPoints.length === 0) {
            throw new Error('No history data available');
        }

        const svg = this.generateSVG(historyPoints, period, lang);
        const fontFiles = FontFinder.findFontFiles();

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

    async generateTimelineChart(historyPoints: HistoryPoint[], hours: number, lang: Language = DEFAULT_LANGUAGE): Promise<Buffer> {
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
