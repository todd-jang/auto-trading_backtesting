import { StockSymbol, CandlestickDataPoint, LiveTick } from '../types';
import { io, Socket } from "https://esm.sh/socket.io-client@4.7.5";

class MarketDataService {
    private socket: Socket | null = null;
    private subscribers: ((tick: LiveTick) => void)[] = [];

    public async getInitialData(): Promise<{ [key in StockSymbol]: CandlestickDataPoint[] }> {
        try {
            const response = await fetch('/api/initial-chart-data');
            if (!response.ok) {
                throw new Error('Failed to fetch initial chart data');
            }
            return await response.json();
        } catch (error) {
            console.error("Error fetching initial data:", error);
            return {} as { [key in StockSymbol]: CandlestickDataPoint[] };
        }
    }

    private connect() {
        if (this.socket && this.socket.connected) return;

        this.socket = io({
            transports: ['websocket'],
        });

        this.socket.on('connect', () => {
            console.log('Market data WebSocket connected.');
        });

        this.socket.on('market_tick', (tick: LiveTick) => {
            this.subscribers.forEach(callback => callback(tick));
        });

        this.socket.on('disconnect', () => {
            console.log('Market data WebSocket disconnected.');
        });
    }

    private disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    public subscribe(callback: (tick: LiveTick) => void) {
        this.subscribers.push(callback);
        if (this.subscribers.length > 0 && (!this.socket || !this.socket.connected)) {
            this.connect();
        }
    }

    public unsubscribe() {
        this.subscribers = [];
        this.disconnect();
    }
}

export const marketDataService = new MarketDataService();

// Helper function from the original service, kept for use in the frontend
export const isMarketOpen = (symbol: StockSymbol, marketStatuses: { [market: string]: 'OPEN' | 'CLOSED' }): boolean => {
    const stockCurrency = symbol === '005930' || symbol === '000660' ? 'KRW' : 'USD';
    const market = stockCurrency === 'KRW' ? 'KOREA' : 'USA';
    return marketStatuses[market] === 'OPEN';
};
