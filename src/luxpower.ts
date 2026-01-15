import axios, {AxiosInstance, AxiosResponse} from 'axios';
import { HistoryCache } from './history-cache';
import { logger } from './logger';

interface RuntimeData {
    success: boolean;
    serialNum: string;
    pToGrid: number;
    pToUser: number;
    vact: number;
    fac: number;
    status: number;
    soc?: number;
    vBat?: number;
    batPower?: number;
    vpv1?: number;
    ppv1?: number;
    vpv2?: number;
    ppv2?: number;
    vpv3?: number;
    ppv3?: number;
    pinv?: number;
    peps?: number;
    consumptionPower?: number;
    statusText?: string;
    deviceTime?: string;

    [key: string]: any;
}

interface ElectricityStatus {
    hasElectricity: boolean;
    gridPower: number;
    timestamp: string;
    rawData: RuntimeData;
}

export class LuxpowerClient {
    private username: string;
    private password: string;
    private apiEndpoint: string;
    private httpClient: AxiosInstance;
    private jsessionId: string | null = null;
    private historyCache: HistoryCache | null;

    constructor(username: string, password: string, apiEndpoint?: string, enableCache: boolean = true) {
        this.username = username;
        this.password = password;
        this.apiEndpoint = apiEndpoint || 'https://eu.luxpowertek.com';
        this.historyCache = enableCache ? new HistoryCache() : null;

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

            const vacr = data.vacr || 0;
            const vact = data.vact || 0;

            const gridVoltage = vacr > 0 ? (vacr / 10).toFixed(1) : (vact > 0 ? (vact / 10).toFixed(1) : '0.0');
            const gridVoltageNum = parseFloat(gridVoltage);
            const gridFrequency = data.fac ? data.fac / 100 : 0;
            const powerToGrid = data.pToGrid || 0;
            const powerToUser = data.pToUser || 0;

            const hasElectricity = gridVoltageNum > 180 && gridFrequency > 45 && gridFrequency < 55;

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
        } catch (error: any) {
            logger.error(`Error checking electricity status: ${error.message}`);
            throw error;
        }
    }

    async getHistoryData(serialNum: string, startDate: Date, endDate: Date): Promise<Array<{timestamp: string, hasElectricity: boolean}>> {
        if (!this.jsessionId) {
            const loggedIn = await this.login();
            if (!loggedIn) {
                throw new Error('Failed to login to Luxpower API');
            }
        }

        const historyPoints: Array<{timestamp: string, hasElectricity: boolean}> = [];
        const maxRowsPerPage = 10000;
        const parallelDays = 10;
        
        const datesToFetch: string[] = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            datesToFetch.push(dateStr);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        const fetchDayData = async (formattedDate: string): Promise<Array<{timestamp: string, hasElectricity: boolean}>> => {
            try {
                if (this.historyCache) {
                    const cachedData = this.historyCache.getCachedData(formattedDate, 1);
                    if (cachedData && cachedData.length > 0) {
                        return cachedData;
                    }
                }
                
                let page = 1;
                let hasMoreData = true;
                const dayPoints: Array<{timestamp: string, hasElectricity: boolean}> = [];
                
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
                            const vacr = parseFloat(point.vacr) || 0;
                            const vact = parseFloat(point.vact) || 0;
                            const gridVoltage = vacr > 0 ? (vacr / 10) : (vact > 0 ? (vact / 10) : 0);
                            const fac = parseFloat(point.fac) || 0;
                            const gridFrequency = fac / 100;
                            const statusText = point.statusText || '';
                            const pToGrid = parseFloat(point.pToGrid) || 0;
                            const pToUser = parseFloat(point.pToUser) || 0;
                            const pinv = parseFloat(point.pinv) || 0;
                            const peps = parseFloat(point.peps) || 0;
                            
                            const hasElectricity = vacr > 0;
                            
                            let timestamp = point.time || new Date().toISOString();
                            if (typeof timestamp === 'string' && !timestamp.includes('T')) {
                                timestamp = `${timestamp.replace(' ', 'T')}.000Z`;
                            }
                            
                            const pointDate = new Date(timestamp);
                            const pointData = {
                                timestamp: pointDate.toISOString(),
                                hasElectricity
                            };
                            
                            dayPoints.push(pointData);
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
        
        return historyPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
}
