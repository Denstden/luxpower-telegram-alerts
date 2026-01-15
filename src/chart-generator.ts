import { Resvg } from '@resvg/resvg-js';
import { getTranslations, Language } from './translations';

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
        const padding = 60;
        const chartWidth = width - leftPadding - rightPadding;
        const chartHeight = height - topPadding - bottomPadding;

        const maxPoints = 100;
        const step = Math.max(1, Math.floor(historyPoints.length / maxPoints));
        const points = [];
        
        for (let i = 0; i < historyPoints.length; i += step) {
            points.push(historyPoints[i]);
        }

        const xStep = chartWidth / Math.max(1, points.length - 1);
        const onColor = '#4ade80';
        const offColor = '#ef4444';
        const bgColor = '#1a1a1a';
        const gridColor = '#374151';
        const textColor = '#ffffff';

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="${width}" height="${height}" fill="${bgColor}"/>`;
        
        const title = lang === 'uk' ? 'Історія статусу електрики' : 'Electricity Status History';
        svg += `<text x="${width / 2}" y="30" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="18" font-weight="bold">${title} - ${periodLabels[period]}</text>`;

        for (let i = 0; i <= 10; i++) {
            const y = topPadding + (chartHeight / 10) * i;
            svg += `<line x1="${leftPadding}" y1="${y}" x2="${width - rightPadding}" y2="${y}" stroke="${gridColor}" stroke-width="1" opacity="0.3"/>`;
        }

        svg += `<line x1="${leftPadding}" y1="${topPadding}" x2="${leftPadding}" y2="${height - bottomPadding}" stroke="${textColor}" stroke-width="2"/>`;
        svg += `<line x1="${leftPadding}" y1="${height - bottomPadding}" x2="${width - rightPadding}" y2="${height - bottomPadding}" stroke="${textColor}" stroke-width="2"/>`;

        const onY = topPadding + chartHeight * 0.1;
        const offY = topPadding + chartHeight * 0.9;

        const onLabelY = lang === 'uk' ? 'Є світло' : 'ON';
        const offLabelY = lang === 'uk' ? 'Нема світла' : 'OFF';
        svg += `<text x="${leftPadding - 10}" y="${onY + 5}" text-anchor="end" fill="${onColor}" font-family="sans-serif" font-size="12">${onLabelY}</text>`;
        svg += `<text x="${leftPadding - 10}" y="${offY + 5}" text-anchor="end" fill="${offColor}" font-family="sans-serif" font-size="12">${offLabelY}</text>`;

        let path = '';
        let lastY = 0;

        for (let i = 0; i < points.length; i++) {
            const x = leftPadding + i * xStep;
            const y = points[i].hasElectricity ? onY : offY;
            const color = points[i].hasElectricity ? onColor : offColor;

            if (i === 0) {
                path = `M ${x} ${y}`;
            } else {
                path += ` L ${x} ${lastY} L ${x} ${y}`;
            }
            lastY = y;
        }

        if (points.length > 1) {
            const lastX = leftPadding + (points.length - 1) * xStep;
            path += ` L ${lastX} ${lastY}`;
        }

        svg += `<path d="${path}" fill="none" stroke="${onColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

        for (let i = 0; i < points.length; i++) {
            const x = leftPadding + i * xStep;
            const y = points[i].hasElectricity ? onY : offY;
            const color = points[i].hasElectricity ? onColor : offColor;
            svg += `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`;
        }

        const labelStep = Math.max(1, Math.floor(points.length / 8));
        const labels: Array<{x: number, label: string}> = [];
        
        for (let i = 0; i < points.length; i += labelStep) {
            const x = leftPadding + i * xStep;
            const date = new Date(points[i].timestamp);
            let label = '';
            
            if (period === 'day') {
                const hour = date.getHours();
                label = `${hour.toString().padStart(2, '0')}:00`;
            } else if (period === 'week') {
                const day = date.getDate();
                const month = date.toLocaleDateString('en-US', { month: 'short' });
                label = `${month} ${day}`;
            } else {
                const day = date.getDate();
                const month = date.toLocaleDateString('en-US', { month: 'short' });
                label = `${month} ${day}`;
            }
            
            labels.push({ x, label });
        }
        
        for (const { x, label } of labels) {
            svg += `<text x="${x}" y="${height - bottomPadding + 20}" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="10" transform="rotate(-45 ${x} ${height - bottomPadding + 20})">${label}</text>`;
        }

        const onCount = historyPoints.filter(p => p.hasElectricity).length;
        const offCount = historyPoints.length - onCount;
        const onPercent = ((onCount / historyPoints.length) * 100).toFixed(1);
        const offPercent = ((offCount / historyPoints.length) * 100).toFixed(1);

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
        const resvg = new Resvg(svg, {
            background: '#1a1a1a',
            fitTo: {
                mode: 'width',
                value: 800
            },
            font: {
                loadSystemFonts: true,
                defaultFontFamily: 'sans-serif'
            }
        });
        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();
        
        return Buffer.from(pngBuffer);
    }

    async generateTimelineChart(historyPoints: HistoryPoint[], hours: number, lang: Language = 'en'): Promise<Buffer> {
        const now = new Date();
        const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
        
        const filteredPoints = historyPoints.filter(p => {
            const pointTime = new Date(p.timestamp);
            return pointTime >= startTime;
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
