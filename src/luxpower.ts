import axios, { AxiosInstance, AxiosResponse } from 'axios';

interface RuntimeData {
  success: boolean;
  serialNum: string;
  pToGrid: number;
  pToUser: number;
  vact: number;
  fac: number;
  status: number;
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
    const loginEndpoints = [
      `${this.apiEndpoint}/WManage/api/user/login`,
      `${this.apiEndpoint}/WManage/api/login`,
      `${this.apiEndpoint}/WManage/web/api/user/login`
    ];

    const loginPayloads = [
      `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`,
      `user=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`,
      `account=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`,
      `email=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`
    ];

    for (const endpoint of loginEndpoints) {
      for (const payload of loginPayloads) {
        try {
          const response: AxiosResponse<any> = await axios.post(
            endpoint,
            payload,
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': this.apiEndpoint,
                'Referer': `${this.apiEndpoint}/WManage/web/monitor/inverter`
              },
              withCredentials: true,
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
                  this.httpClient.defaults.headers.common['Cookie'] = `JSESSIONID=${this.jsessionId}`;
                  console.log('Successfully logged in');
                  return true;
                }
              }
            }
          }

          if (response.data?.success === true || response.data?.code === 0) {
            const cookies = response.headers['set-cookie'] || [];
            for (const cookie of cookies) {
              const match = cookie.match(/JSESSIONID=([^;]+)/);
              if (match) {
                this.jsessionId = match[1];
                if (this.jsessionId) {
                  this.httpClient.defaults.headers.common['Cookie'] = `JSESSIONID=${this.jsessionId}`;
                  console.log('Successfully logged in');
                  return true;
                }
              }
            }
          }
        } catch (error: any) {
          if (error.response?.status === 302 || error.response?.status === 301) {
            const location = error.response.headers.location;
            const cookies = error.response.headers['set-cookie'] || [];
            for (const cookie of cookies) {
              const match = cookie.match(/JSESSIONID=([^;]+)/);
              if (match) {
                this.jsessionId = match[1];
                if (this.jsessionId) {
                  this.httpClient.defaults.headers.common['Cookie'] = `JSESSIONID=${this.jsessionId}`;
                  console.log('Successfully logged in (redirect)');
                  return true;
                }
              }
            }
          }
          continue;
        }
      }
    }

    console.error('Login failed. Please check your credentials or provide the login endpoint from browser Network tab.');
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

      const gridVoltage = data.vact ? data.vact / 100 : 0;
      const gridFrequency = data.fac ? data.fac / 100 : 0;
      const powerToGrid = data.pToGrid || 0;
      const powerToUser = data.pToUser || 0;

      const hasElectricity = gridVoltage > 180 && gridFrequency > 45 && gridFrequency < 55;

      const gridPower = powerToGrid !== 0 ? powerToGrid : (powerToUser !== 0 ? -powerToUser : 0);

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
