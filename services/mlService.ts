import { ChartDataPoint, MlFeatures } from '../types';

// This service acts as the "Data API", preparing raw price data into structured features for the ML inference model.

const calculateRSI = (data: ChartDataPoint[], period = 14): number => {
    if (data.length < period + 1) return 50; // Neutral RSI if not enough data
    const changes = data.slice(1).map((p, i) => p.price - data[i].price);
    const recentChanges = changes.slice(-period);

    const gains = recentChanges.filter(c => c > 0).reduce((acc, c) => acc + c, 0);
    const losses = recentChanges.filter(c => c < 0).reduce((acc, c) => acc + Math.abs(c), 0);

    if (losses === 0) return 100; // All gains, max RSI
    if (gains === 0) return 0; // All losses, min RSI

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

const calculateVolatility = (prices: number[]): number => {
    const n = prices.length;
    if (n < 2) return 0;
    const mean = prices.reduce((a, b) => a + b) / n;
    const variance = prices.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / (n - 1);
    return Math.sqrt(variance);
};

export const extractFeaturesFromData = (data: ChartDataPoint[]): MlFeatures => {
    if (data.length < 21) {
        // Return neutral/default features if not enough data
        return {
            priceChange5m: 0,
            priceChange20m: 0,
            volatility10m: 0,
            rsi14m: 50,
        };
    }

    const prices = data.map(p => p.price);
    const latestPrice = prices[prices.length - 1];

    const price5m = prices[prices.length - 6];
    const price20m = prices[prices.length - 21];
    
    const volatility = calculateVolatility(prices.slice(-10));

    return {
        priceChange5m: ((latestPrice - price5m) / price5m) * 100,
        priceChange20m: ((latestPrice - price20m) / price20m) * 100,
        volatility10m: (volatility / latestPrice) * 100,
        rsi14m: calculateRSI(data),
    };
};
