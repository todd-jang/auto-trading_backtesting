
import { StockSymbol, FundamentalData } from '../types';

const initialFundamentalData: { [key in StockSymbol]: FundamentalData } = {
  [StockSymbol.SAMSUNG]: { peRatio: 18.5, epsGrowth: 8.2, debtToEquity: 0.4 },
  [StockSymbol.HYNIX]: { peRatio: 25.0, epsGrowth: 15.5, debtToEquity: 0.6 },
  [StockSymbol.NVIDIA]: { peRatio: 75.0, epsGrowth: 30.0, debtToEquity: 0.3 },
  [StockSymbol.TSMC]: { peRatio: 30.0, epsGrowth: 22.0, debtToEquity: 0.2 },
  [StockSymbol.MICRON]: { peRatio: 40.0, epsGrowth: 18.0, debtToEquity: 0.5 },
  [StockSymbol.CXMT]: { peRatio: 35.0, epsGrowth: 25.0, debtToEquity: 0.7 },
};

export const initializeFundamentalData = (): { [key in StockSymbol]: FundamentalData } => {
  return JSON.parse(JSON.stringify(initialFundamentalData));
};

function gaussianRandom(): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export const getUpdatedFundamentalData = (currentData: FundamentalData): FundamentalData => {
    // Simulate slight, slow-moving changes in fundamental data
    const updatedData = { ...currentData };
    updatedData.peRatio += gaussianRandom() * 0.1;
    updatedData.epsGrowth += gaussianRandom() * 0.05;
    updatedData.debtToEquity += gaussianRandom() * 0.001;

    // Clamp values to realistic ranges
    updatedData.peRatio = Math.max(5, updatedData.peRatio);
    updatedData.epsGrowth = Math.max(-10, updatedData.epsGrowth);
    updatedData.debtToEquity = Math.max(0.1, updatedData.debtToEquity);

    return updatedData;
};