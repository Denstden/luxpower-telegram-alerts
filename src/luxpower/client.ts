import axios, {AxiosInstance, AxiosResponse} from 'axios';
import {HistoryCache} from '../storage';
import {logger} from '../utils';
import {ElectricityStatus, HistoryPoint, RuntimeData} from './types';
import {LuxpowerDataProcessor} from './data-processor';

export class LuxpowerClient {
    private username: string;
    private password: string;
    private apiEndpoint: string;
    private httpClient: AxiosInstance;
    private jsessionId: string | null = null;
    private historyCache: HistoryCache | null;
    private dataProcessor: LuxpowerDataProcessor;

    constructor(username: string, password: string, apiEndpoint?: string, enableCache: boolean = true) {
        this.username = username;
        this.password = password;
        this.apiEndpoint = apiEndpoint || 'https://eu.luxpowertek.com';
        this.historyCache = enableCache ? new HistoryCache() : null;
        this.dataProcessor = new LuxpowerDataProcessor();

        this.httpClient = axios.create({
            baseURL: this.apiEndpoint,
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': this.apiEndpoint,
                'Referer': `${this.apiEndpoint}/WManage/web/monitor/inverter`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
            },
            withCredentials: true
        });
    }

    async login(): Promise<boolean> {
        try {
            const response: AxiosResponse<any> = await this.httpClient.post(
                '/WManage/api/login',
                `account=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`,
                {
                    maxRedirects: 0,
                    validateStatus: (status) => status < 400
                }
            );

            const cookies = response.headers['set-cookie'];
            if (cookies) {
                for (const cookie of cookies) {
                    const match = cookie.match(/JSESSIONID=([^;]+)/);
                    if (match) {
                        this.jsessionId = match[1];
                        if (this.jsessionId) {
                            logger.info('Successfully logged in');
                            return true;
                        }
                    }
                }
            }
        } catch (error: any) {
            logger.warn(`Error logging in: ${error.message}`);
        }

        logger.error('Login failed. Please check your credentials.');
        return false;
    }

    async getInverterRuntime(serialNum: string): Promise<RuntimeData> {
        if (!this.jsessionId) {
            const loggedIn = await this.login();
            if (!loggedIn) {
                throw new Error('Failed to login to Luxpower API');
            }
        }

        try {
            const response: AxiosResponse<RuntimeData> = await this.httpClient.post(
                '/WManage/api/inverter/getInverterRuntime',
                `serialNum=${serialNum}`,
                {
                    headers: {
                        'Cookie': `JSESSIONID=${this.jsessionId}`
                    }
                }
            );

            if (response.data?.success === false) {
                throw new Error('API returned success: false');
            }

            return response.data;
        } catch (error: any) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                logger.warn(`Error getting inverter info: ${error.message}`);
                this.jsessionId = null;
                const loggedIn = await this.login();
                if (!loggedIn) {
                    throw new Error('Failed to re-login to Luxpower API');
                }
                return this.getInverterRuntime(serialNum);
            }
            throw error;
        }
    }

    async checkElectricityStatus(serialNum: string): Promise<ElectricityStatus> {
        try {
            const data = await this.getInverterRuntime(serialNum);
            return this.dataProcessor.processRuntimeData(data);
        } catch (error: any) {
            logger.error(`Error checking electricity status: ${error.message}`);
            throw error;
        }
    }

    async getHistoryData(serialNum: string, startDate: Date, endDate: Date): Promise<HistoryPoint[]> {
        if (!this.jsessionId) {
            const loggedIn = await this.login();
            if (!loggedIn) {
                throw new Error('Failed to login to Luxpower API');
            }
        }

        const historyPoints: HistoryPoint[] = [];
        const maxRowsPerPage = 10000;
        const parallelDays = 10;

        const datesToFetch: string[] = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            datesToFetch.push(dateStr);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const fetchDayData = async (formattedDate: string): Promise<HistoryPoint[]> => {
            try {
                if (this.historyCache) {
                    const cachedData = this.historyCache.getCachedData(formattedDate, 1);
                    if (cachedData && cachedData.length > 0) {
                        const isComplete = this.historyCache.isCacheComplete(formattedDate);
                        if (isComplete) {
                            return cachedData;
                        } else {
                            logger.info(`Cache for ${formattedDate} is incomplete (missing 11 PM+ data), re-fetching...`);
                        }
                    }
                }

                let page = 1;
                let hasMoreData = true;
                const dayPoints: HistoryPoint[] = [];

                while (hasMoreData) {
                    const response: AxiosResponse<any> = await this.httpClient.post(
                        `/WManage/web/analyze/data/${formattedDate}?serialNum=${serialNum}`,
                        `page=${page}&rows=${maxRowsPerPage}`,
                        {
                            headers: {
                                'Cookie': `JSESSIONID=${this.jsessionId}`,
                                'Referer': `${this.apiEndpoint}/WManage/web/analyze/data`
                            }
                        }
                    );

                    if (response.data?.rows && Array.isArray(response.data.rows)) {
                        const rowsCount = response.data.rows.length;
                        const totalRows = response.data.total || 0;

                        if (rowsCount === 0) {
                            hasMoreData = false;
                            break;
                        }

                        for (const point of response.data.rows) {
                            const processedPoint = this.dataProcessor.processHistoryPoint(point);
                            if (processedPoint) {
                                dayPoints.push(processedPoint);
                            }
                        }

                        if (rowsCount < maxRowsPerPage) {
                            hasMoreData = false;
                        } else if (totalRows > 0 && (page * maxRowsPerPage >= totalRows)) {
                            hasMoreData = false;
                        } else {
                            page++;
                        }
                    } else {
                        hasMoreData = false;
                    }
                }

                if (dayPoints.length > 0 && this.historyCache) {
                    this.historyCache.saveCachedData(formattedDate, dayPoints);
                }

                return dayPoints;
            } catch (error: any) {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    logger.warn(`Error getting history data for ${formattedDate}: ${error.message}`);
                    this.jsessionId = null;
                    const loggedIn = await this.login();
                    if (!loggedIn) {
                        throw new Error('Failed to re-login to Luxpower API');
                    }
                    return fetchDayData(formattedDate);
                }

                if (error.response?.status === 404 || error.response?.status === 400) {
                    return [];
                }

                logger.warn(`Error fetching data for ${formattedDate}: ${error.message}`);
                return [];
            }
        };

        for (let i = 0; i < datesToFetch.length; i += parallelDays) {
            const batch = datesToFetch.slice(i, i + parallelDays);

            const results = await Promise.all(batch.map(date => fetchDayData(date)));

            for (const dayData of results) {
                for (const point of dayData) {
                    const pointDate = new Date(point.timestamp);
                    if (pointDate >= startDate && pointDate <= endDate) {
                        historyPoints.push(point);
                    }
                }
            }
        }

        const sorted = historyPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (this.historyCache) {
            return this.historyCache.filterChangePoints(sorted);
        }

        return sorted;
    }
}
