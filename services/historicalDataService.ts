
import { StockSymbol, CandlestickDataPoint } from '../types';

// This is a mock service. In a real application, this data would be fetched from a financial data API.
// We are generating a realistic-looking dataset for demonstration purposes.

const generateHistoricalData = (symbol: StockSymbol, initialPrice: number, numPoints: number): CandlestickDataPoint[] => {
    const data: CandlestickDataPoint[] = [];
    let lastClose = initialPrice;
    const startDate = new Date('2023-01-01');

    for (let i = 0; i < numPoints; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const time = date.toISOString().split('T')[0];

        const volatility = 0.025;
        const trend = (i - numPoints / 2) / (numPoints * 200); // Gentle overall trend

        const open = lastClose * (1 + (Math.random() - 0.5) * 0.01);
        const change = (Math.random() - 0.49 + trend) * volatility; // slightly positive bias
        let close = open * (1 + change);

        const high = Math.max(open, close) * (1 + Math.random() * 0.015);
        const low = Math.min(open, close) * (1 - Math.random() * 0.015);
        
        close = Math.max(1, close) // ensure price doesn't go to 0

        data.push({ time, open, high, low, close });
        lastClose = close;
    }
    return data;
};

const INITIAL_PRICES_BACKTEST: { [key in StockSymbol]: number } = {
  [StockSymbol.SAMSUNG]: 70000,
  [StockSymbol.HYNIX]: 100000,
  [StockSymbol.NVIDIA]: 25, // Adjusted for split
  [StockSymbol.TSMC]: 90,
  [StockSymbol.MICRON]: 60,
};

const DATA_POINTS = 400;

export const historicalData: { [key in StockSymbol]: CandlestickDataPoint[] } = {
    [StockSymbol.SAMSUNG]: generateHistoricalData(StockSymbol.SAMSUNG, INITIAL_PRICES_BACKTEST[StockSymbol.SAMSUNG], DATA_POINTS),
    [StockSymbol.HYNIX]: generateHistoricalData(StockSymbol.HYNIX, INITIAL_PRICES_BACKTEST[StockSymbol.HYNIX], DATA_POINTS),
    [StockSymbol.NVIDIA]: generateHistoricalData(StockSymbol.NVIDIA, INITIAL_PRICES_BACKTEST[StockSymbol.NVIDIA], DATA_POINTS),
    [StockSymbol.TSMC]: generateHistoricalData(StockSymbol.TSMC, INITIAL_PRICES_BACKTEST[StockSymbol.TSMC], DATA_POINTS),
    [StockSymbol.MICRON]: generateHistoricalData(StockSymbol.MICRON, INITIAL_PRICES_BACKTEST[StockSymbol.MICRON], DATA_POINTS),
};
