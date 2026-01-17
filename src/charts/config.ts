import {getChartLeftPadding, Language} from '../utils';
import {ChartConfig} from './types';

export class ChartConfigBuilder {
    static build(lang: Language): ChartConfig {
        const width = 800;
        const height = 400;
        const leftPadding = getChartLeftPadding(lang);
        const rightPadding = 60;
        const topPadding = 60;
        const bottomPadding = 60;

        return {
            width,
            height,
            leftPadding,
            rightPadding,
            topPadding,
            bottomPadding,
            chartWidth: width - leftPadding - rightPadding,
            chartHeight: height - topPadding - bottomPadding
        };
    }
}
