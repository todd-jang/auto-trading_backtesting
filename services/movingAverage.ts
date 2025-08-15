import { ChartDataPoint } from '../types';

export const calculateSMA = (data: ChartDataPoint[], period: number): number | null => {
    if (data.length < period) {
        return null; // Not enough data
    }

    const relevantData = data.slice(-period);
    const sum = relevantData.reduce((acc, point) => acc + point.price, 0);
    
    return sum / period;
};
