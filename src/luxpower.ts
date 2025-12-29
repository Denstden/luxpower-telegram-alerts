import axios, {AxiosInstance, AxiosResponse} from 'axios';

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

    constructor(username: string, password: string, apiEndpoint?: string) {
        this.username = username;
        this.password = password;
        this.apiEndpoint = apiEndpoint || 'https://eu.luxpowertek.com';

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
                            console.log('Successfully logged in 1');
                            return true;
                        }
                    }
                }
            }
        } catch (error: any) {
            console.warn('Error logging in', error);
        }

        console.error('Login failed. Please check your credentials.');
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
                console.warn(`Error getting inverter info`, error)
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
            console.error('Error checking electricity status:', error.message);
            throw error;
        }
    }
}
