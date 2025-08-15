
import { StockSymbol, CandlestickDataPoint } from '../types';

// This service provides the initial seed data for the charts before live data starts streaming.

const generateInitialData = (symbol: StockSymbol, initialPrice: number, numPoints: number): CandlestickDataPoint[] => {
    const data: CandlestickDataPoint[] = [];
    let lastClose = initialPrice;
    const startDate = new Date();
    startDate.setMinutes(startDate.getMinutes() - numPoints);


    for (let i = 0; i < numPoints; i++) {
        const date = new Date(startDate);
        date.setMinutes(startDate.getMinutes() + i);
        const time = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit', hour12: false});

        const volatility = 0.025;
        const trend = (i - numPoints / 2) / (numPoints * 200);

        const open = lastClose * (1 + (Math.random() - 0.5) * 0.01);
        const change = (Math.random() - 0.49 + trend) * volatility;
        let close = open * (1 + change);

        const high = Math.max(open, close) * (1 + Math.random() * 0.015);
        const low = Math.min(open, close) * (1 - Math.random() * 0.015);
        
        close = Math.max(1, close);

        data.push({ time, open, high, low, close });
        lastClose = close;
    }
    return data;
};

const INITIAL_PRICES_LIVE: { [key in StockSymbol]: number } = {
  [StockSymbol.SAMSUNG]: 81500,
  [StockSymbol.HYNIX]: 228000,
  [StockSymbol.NVIDIA]: 125,
  [StockSymbol.TSMC]: 172,
  [StockSymbol.MICRON]: 141,
  [StockSymbol.CXMT]: 25,
};

const DATA_POINTS = 50;

export const initialData: { [key in StockSymbol]: CandlestickDataPoint[] } = {
    [StockSymbol.SAMSUNG]: generateInitialData(StockSymbol.SAMSUNG, INITIAL_PRICES_LIVE[StockSymbol.SAMSUNG], DATA_POINTS),
    [StockSymbol.HYNIX]: generateInitialData(StockSymbol.HYNIX, INITIAL_PRICES_LIVE[StockSymbol.HYNIX], DATA_POINTS),
    [StockSymbol.NVIDIA]: generateInitialData(StockSymbol.NVIDIA, INITIAL_PRICES_LIVE[StockSymbol.NVIDIA], DATA_POINTS),
    [StockSymbol.TSMC]: generateInitialData(StockSymbol.TSMC, INITIAL_PRICES_LIVE[StockSymbol.TSMC], DATA_POINTS),
    [StockSymbol.MICRON]: generateInitialData(StockSymbol.MICRON, INITIAL_PRICES_LIVE[StockSymbol.MICRON], DATA_POINTS),
    [StockSymbol.CXMT]: generateInitialData(StockSymbol.CXMT, INITIAL_PRICES_LIVE[StockSymbol.CXMT], DATA_POINTS),
};