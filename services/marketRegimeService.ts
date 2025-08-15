import { ChartDataPoint, MarketRegime, NormalizedChartDataPoint, StockSymbol } from '../types';
import { calculateSMA } from './movingAverage';

// Helper to calculate standard deviation
const calculateStdDev = (data: number[]): number => {
    const n = data.length;
    if (n === 0) return 0;
    const mean = data.reduce((a, b) => a + b) / n;
    const variance = data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n;
    return Math.sqrt(variance);
};

export const detectMarketRegime = (
    chartData: { [key in StockSymbol]: ChartDataPoint[] }
): MarketRegime => {
    const allPrices: number[] = [];
    const recentChanges: number[] = [];

    const stockDataArrays = Object.values(chartData);

    if (stockDataArrays.length === 0 || stockDataArrays[0].length < 20) {
        return MarketRegime.NEUTRAL; // Not enough data
    }
    
    const historyLength = stockDataArrays[0].length;
    
    // Create an average market price series
    const avgMarketPrices: ChartDataPoint[] = [];
    for (let i = 0; i < historyLength; i++) {
        let sum = 0;
        let count = 0;
        for (const stockData of stockDataArrays) {
            if (stockData[i]) {
                sum += stockData[i].price;
                count++;
            }
        }
        if (count > 0) {
            avgMarketPrices.push({ time: stockDataArrays[0][i].time, price: sum / count });
        }
    }

    // 1. Calculate Volatility (using standard deviation of returns)
    const returns = avgMarketPrices.slice(1).map((p, i) => (p.price - avgMarketPrices[i].price) / avgMarketPrices[i].price);
    const volatility = calculateStdDev(returns.slice(-20)) * 100; // Volatility as percentage

    // 2. Calculate Trend Strength (e.g., using slope of a moving average)
    const shortMA = calculateSMA(avgMarketPrices, 5);
    const longMA = calculateSMA(avgMarketPrices, 20);

    let trendStrength = 0;
    if (shortMA && longMA && longMA > 0) {
        trendStrength = Math.abs((shortMA - longMA) / longMA);
    }

    // 3. Determine Regime
    if (trendStrength > 0.015) { // If MA's are more than 1.5% apart
        return MarketRegime.TRENDING;
    }
    if (volatility > 0.8) { // High volatility without a clear trend
        return MarketRegime.RANGING;
    }
    if (volatility < 0.3) { // Very low volatility
        return MarketRegime.LOW_VOLATILITY;
    }
    
    return MarketRegime.NEUTRAL;
};
