import { StockSymbol, CandlestickDataPoint, LiveTick, Currency } from '../types';
import { STOCKS } from '../constants';

// --- Configuration for the simulation model ---
const INITIAL_PRICES: { [key in StockSymbol]: number } = {
  [StockSymbol.SAMSUNG]: 81500,
  [StockSymbol.HYNIX]: 228000,
  [StockSymbol.NVIDIA]: 125,
  [StockSymbol.TSMC]: 172,
  [StockSymbol.MICRON]: 141,
  [StockSymbol.CXMT]: 25,
};

const STOCK_CHARACTERISTICS: { [key in StockSymbol]: { baseVolatility: number; trendBias: number } } = {
  [StockSymbol.SAMSUNG]: { baseVolatility: 0.015, trendBias: 0.51 }, // Stable blue-chip
  [StockSymbol.HYNIX]:   { baseVolatility: 0.025, trendBias: 0.55 }, // More volatile memory stock
  [StockSymbol.NVIDIA]:  { baseVolatility: 0.035, trendBias: 0.60 }, // High-growth, high-volatility
  [StockSymbol.TSMC]:    { baseVolatility: 0.020, trendBias: 0.53 }, // Stable industry leader
  [StockSymbol.MICRON]:  { baseVolatility: 0.030, trendBias: 0.50 }, // Cyclical and volatile
  [StockSymbol.CXMT]:    { baseVolatility: 0.040, trendBias: 0.48 }, // Speculative, high-risk
};

const DATA_POINTS = 50;
const TICK_INTERVAL = 800; // ms

// --- Market Hours Configuration (in UTC) ---
const marketTimezones: { [key in Currency]: string } = {
    [Currency.KRW]: 'Asia/Seoul',   // KST = UTC+9
    [Currency.USD]: 'America/New_York', // EST = UTC-5, EDT = UTC-4
};

// KRX: 09:00-15:30 KST -> 00:00-06:30 UTC
// NYSE: 09:30-16:00 EDT -> 13:30-20:00 UTC
const marketHoursUTC: { [key in Currency]: { open: number, close: number } } = {
    [Currency.KRW]: { open: 0, close: 6.5 },
    [Currency.USD]: { open: 13.5, close: 20 },
};

export const isMarketOpen = (symbol: StockSymbol): boolean => {
    const stockCurrency = STOCKS[symbol].currency;
    const hours = marketHoursUTC[stockCurrency];
    const now = new Date();
    const currentUTCHour = now.getUTCHours() + now.getUTCMinutes() / 60;
    
    // Simple check, doesn't account for holidays
    return currentUTCHour >= hours.open && currentUTCHour < hours.close;
};


// --- Market Simulation Service ---

interface MarketState {
    price: number;
    trend: 'up' | 'down' | 'sideways';
    trendStrength: number; // 0 to 1
    volatility: number; // multiplier
    meanReversionFactor: number; // 0 to 1
    lastMeanPrice: number;
    trendCounter: number; // How long has the trend been active
}

class MarketDataService {
    private subscribers: ((tick: LiveTick) => void)[] = [];
    private intervalId: number | null = null;
    private marketStates: { [key in StockSymbol]: MarketState };

    constructor() {
        this.marketStates = {} as { [key in StockSymbol]: MarketState };
        for (const symbol of Object.keys(STOCKS) as StockSymbol[]) {
            this.marketStates[symbol] = {
                price: INITIAL_PRICES[symbol],
                trend: 'sideways',
                trendStrength: 0.1,
                volatility: STOCK_CHARACTERISTICS[symbol].baseVolatility,
                meanReversionFactor: 0.1,
                lastMeanPrice: INITIAL_PRICES[symbol],
                trendCounter: 0,
            };
        }
    }

    public getInitialData(): { [key in StockSymbol]: CandlestickDataPoint[] } {
        const allData: { [key in StockSymbol]?: CandlestickDataPoint[] } = {};
        for (const symbol of Object.keys(STOCKS) as StockSymbol[]) {
            allData[symbol] = this.generateInitialHistory(symbol, DATA_POINTS);
        }
        return allData as { [key in StockSymbol]: CandlestickDataPoint[] };
    }

    private generateInitialHistory(symbol: StockSymbol, numPoints: number): CandlestickDataPoint[] {
        const data: CandlestickDataPoint[] = [];
        let lastClose = INITIAL_PRICES[symbol];
        const startDate = new Date();
        startDate.setMinutes(startDate.getMinutes() - numPoints);

        for (let i = 0; i < numPoints; i++) {
            const date = new Date(startDate);
            date.setMinutes(startDate.getMinutes() + i);
            const time = date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second: '2-digit', hour12: false });
            
            this.updateMarketState(symbol);
            const state = this.marketStates[symbol];
            
            const open = lastClose * (1 + (Math.random() - 0.5) * state.volatility * 0.1);
            const priceMove = this.calculatePriceMove(state);
            let close = open * (1 + priceMove);

            const high = Math.max(open, close) * (1 + Math.random() * state.volatility * 0.5);
            const low = Math.min(open, close) * (1 - Math.random() * state.volatility * 0.5);
            
            close = Math.max(1, close);

            data.push({ time, open, high, low, close });
            lastClose = close;
            state.price = close;
        }
        return data;
    }

    private updateMarketState(symbol: StockSymbol): void {
        const state = this.marketStates[symbol];
        state.trendCounter++;
        
        // Occasionally change trend direction
        if (state.trendCounter > 30 + Math.random() * 40) {
            const rand = Math.random();
            if (rand < 0.33) state.trend = 'up';
            else if (rand < 0.66) state.trend = 'down';
            else state.trend = 'sideways';
            
            state.trendStrength = Math.random() * 0.5 + 0.1;
            state.meanReversionFactor = Math.random() * 0.3;
            state.trendCounter = 0;
            state.lastMeanPrice = state.price;
        }

        // Volatility can cluster
        state.volatility = STOCK_CHARACTERISTICS[symbol].baseVolatility * (0.8 + Math.random() * 0.7);
    }
    
    private calculatePriceMove(state: MarketState): number {
        // 1. Base random move
        const randomComponent = (Math.random() - 0.5) * 2 * state.volatility;

        // 2. Trend component
        let trendComponent = 0;
        if (state.trend === 'up') {
            trendComponent = state.trendStrength * state.volatility * Math.random();
        } else if (state.trend === 'down') {
            trendComponent = -state.trendStrength * state.volatility * Math.random();
        }

        // 3. Mean reversion component
        const meanReversionComponent = (state.lastMeanPrice - state.price) / state.price * state.meanReversionFactor * Math.random();

        return randomComponent + trendComponent + meanReversionComponent;
    }

    private generateTick(): LiveTick | null {
        const allStockSymbols = Object.keys(STOCKS) as StockSymbol[];
        const openMarkets = allStockSymbols.filter(symbol => isMarketOpen(symbol));

        if (openMarkets.length === 0) {
            return null; // No markets open, no ticks
        }

        const randomSymbol = openMarkets[Math.floor(Math.random() * openMarkets.length)];
        
        this.updateMarketState(randomSymbol);
        const state = this.marketStates[randomSymbol];
        
        const priceMove = this.calculatePriceMove(state);
        const newPrice = parseFloat((state.price * (1 + priceMove)).toFixed(2));
        
        state.price = newPrice > 0 ? newPrice : state.price;

        return {
            symbol: randomSymbol,
            price: state.price,
            timestamp: Date.now(),
        };
    }

    private start() {
        if (this.intervalId) return;
        this.intervalId = window.setInterval(() => {
            const tick = this.generateTick();
            if (tick) {
                this.subscribers.forEach(callback => callback(tick));
            }
        }, TICK_INTERVAL);
    }

    private stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    public subscribe(callback: (tick: LiveTick) => void) {
        this.subscribers.push(callback);
        if (this.subscribers.length > 0 && !this.intervalId) {
            this.start();
        }
    }

    public unsubscribe() {
        this.subscribers = [];
        this.stop();
    }
}

export const marketDataService = new MarketDataService();