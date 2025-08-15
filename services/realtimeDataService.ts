
import { StockSymbol, LiveTick } from '../types';
import { STOCKS } from '../constants';

class RealtimeDataService {
    private subscribers: ((tick: LiveTick) => void)[] = [];
    private intervalId: number | null = null;
    private currentPrices: { [key in StockSymbol]: number };

    constructor() {
        this.currentPrices = {
            [StockSymbol.SAMSUNG]: 81500,
            [StockSymbol.HYNIX]: 228000,
            [StockSymbol.NVIDIA]: 125,
            [StockSymbol.TSMC]: 172,
            [StockSymbol.MICRON]: 141,
            [StockSymbol.CXMT]: 25,
        };
    }

    private generateTick(): LiveTick {
        const stockSymbols = Object.keys(STOCKS) as StockSymbol[];
        const randomSymbol = stockSymbols[Math.floor(Math.random() * stockSymbols.length)];
        
        const price = this.currentPrices[randomSymbol];
        const volatility = 0.001; // Max 0.1% change per tick
        const changePercent = (Math.random() - 0.5) * 2 * volatility;
        const newPrice = parseFloat((price * (1 + changePercent)).toFixed(2));
        
        this.currentPrices[randomSymbol] = newPrice;

        return {
            symbol: randomSymbol,
            price: newPrice,
            timestamp: Date.now(),
        };
    }

    private start() {
        if (this.intervalId) return;
        this.intervalId = window.setInterval(() => {
            const tick = this.generateTick();
            this.subscribers.forEach(callback => callback(tick));
        }, 800); // Average tick speed
    }

    private stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    subscribe(callback: (tick: LiveTick) => void) {
        this.subscribers.push(callback);
        if (this.subscribers.length > 0 && !this.intervalId) {
            this.start();
        }
    }

    unsubscribe() {
        this.subscribers = [];
        this.stop();
    }
}

export const realtimeDataService = new RealtimeDataService();