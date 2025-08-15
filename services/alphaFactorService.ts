import { StockSymbol, AlphaFactors, ChartDataPoint, HedgeFundStrategy } from '../types';

const initialFactors: { [key in StockSymbol]: AlphaFactors } = {
  [StockSymbol.SAMSUNG]: { value: 75, momentum: 50, meanReversion: 50, compositeAlphaScore: 0 },
  [StockSymbol.HYNIX]: { value: 70, momentum: 50, meanReversion: 50, compositeAlphaScore: 0 },
  [StockSymbol.NVIDIA]: { value: 90, momentum: 50, meanReversion: 50, compositeAlphaScore: 0 },
  [StockSymbol.TSMC]: { value: 85, momentum: 50, meanReversion: 50, compositeAlphaScore: 0 },
  [StockSymbol.MICRON]: { value: 65, momentum: 50, meanReversion: 50, compositeAlphaScore: 0 },
};

export const initializeAlphaFactors = (): { [key in StockSymbol]: AlphaFactors } => {
  return JSON.parse(JSON.stringify(initialFactors));
};

function gaussianRandom(): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

const calculateMomentum = (history: ChartDataPoint[], period = 14): number => {
    if (history.length < period) return 50;
    const currentPrice = history[history.length - 1].price;
    const pastPrice = history[history.length - period].price;
    const roc = ((currentPrice - pastPrice) / pastPrice) * 100;
    // Normalize ROC to a 0-100 scale. Assuming ROC typically ranges from -20% to 20%.
    const normalized = 50 + (roc * 2.5);
    return Math.max(0, Math.min(100, normalized));
};

const calculateMeanReversion = (history: ChartDataPoint[], period = 14): number => {
    if (history.length < period) return 50;
    const changes = history.slice(1).map((p, i) => p.price - history[i].price);
    const recentChanges = changes.slice(-period);

    const gains = recentChanges.filter(c => c > 0).reduce((acc, c) => acc + c, 0);
    const losses = recentChanges.filter(c => c < 0).reduce((acc, c) => acc + Math.abs(c), 0);

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    // RSI is already 0-100, but we invert it for our score, so high RSI (overbought) = low score
    return 100 - rsi; 
};


export const getUpdatedAlphaFactors = (
  currentFactors: AlphaFactors,
  history: ChartDataPoint[],
  activeStrategy: HedgeFundStrategy = HedgeFundStrategy.ALPHA_MOMENTUM
): AlphaFactors => {

    const newFactors: AlphaFactors = {
        value: currentFactors.value, // Value factor would be updated slower, e.g. from news/filings. Here we simulate small drift.
        momentum: calculateMomentum(history),
        meanReversion: calculateMeanReversion(history),
        compositeAlphaScore: 0
    };
    
    // Simulate drift for the 'value' factor
    newFactors.value += gaussianRandom() * 0.5;
    newFactors.value = Math.max(0, Math.min(100, newFactors.value));

    // Calculate composite score with dynamic weighting based on strategy
    let weights = { value: 0.3, momentum: 0.5, meanReversion: 0.2 }; // Default for Momentum
    if (activeStrategy === HedgeFundStrategy.MEAN_REVERSION) {
        weights = { value: 0.3, momentum: 0.2, meanReversion: 0.5 };
    }
    
    newFactors.compositeAlphaScore = 
        newFactors.value * weights.value +
        newFactors.momentum * weights.momentum +
        newFactors.meanReversion * weights.meanReversion;
        
    return newFactors;
};
