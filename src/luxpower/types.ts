export interface RuntimeData {
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

export interface ElectricityStatus {
    hasElectricity: boolean;
    gridPower: number;
    timestamp: string;
    rawData: RuntimeData;
}

export interface HistoryPoint {
    timestamp: string;
    hasElectricity: boolean;
}
