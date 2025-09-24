
import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import yahooFinance from 'yahoo-finance2';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

import { 
    Stock, StockSymbol, CandlestickDataPoint, LiveTick, Currency, Portfolio, BankTransaction, 
    TradeAction, PositionType, PairTrade, MarketRegime, HedgeFundStrategy, AlphaFactors, 
    FundamentalData, Trend, OrderConfirmation, TransactionType, ChartDataPoint, AITradeSignal, MlFeatures, 
    BacktestResult, BacktestMetrics, BacktestTradeLogEntry, EquityDataPoint, PortfolioHolding
} from '../types';
import { STOCKS } from '../constants';
import { getMovingAverageCrossSignal } from '../services/technicalAnalysisService';
import { getPairsTradingSignal } from '../services/pairsTradingService';
import { extractFeaturesFromData } from '../services/mlService';

// --- ENVIRONMENT & AI SETUP ---
if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. AI features will fail.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const YFINANCE_TICKERS: { [key in StockSymbol]?: string } = {
    [StockSymbol.SAMSUNG]: '005930.KS', [StockSymbol.HYNIX]: '000660.KS',
    [StockSymbol.NVIDIA]: 'NVDA', [StockSymbol.TSMC]: 'TSM', [StockSymbol.MICRON]: 'MU',
};
const PUBLIC_SYMBOLS = Object.keys(YFINANCE_TICKERS) as StockSymbol[];

// --- SERVER STATE MANAGEMENT ---
interface ServerState {
    exchangeRate: number;
    marketStatuses: { [market: string]: 'OPEN' | 'CLOSED' };
    portfolio: Portfolio;
    bank: { balance: number; transactions: BankTransaction[] };
    alphaFactors: { [key in StockSymbol]: AlphaFactors };
    fundamentalData: { [key in StockSymbol]: FundamentalData };
    chartData: { [key in StockSymbol]: CandlestickDataPoint[] };
    priceHistory: { [key in StockSymbol]: ChartDataPoint[] };
    marketRegime: MarketRegime;
    lastTicks: { [key in StockSymbol]?: LiveTick };
}

const state: ServerState = {
    exchangeRate: 1380.00,
    marketStatuses: { KOREA: 'CLOSED', USA: 'CLOSED' },
    portfolio: { cash: 1_000_000, holdings: {}, pairTrades: {} },
    bank: { balance: 0, transactions: [] },
    alphaFactors: {} as any,
    fundamentalData: {} as any,
    chartData: {} as any,
    priceHistory: {} as any,
    marketRegime: MarketRegime.NEUTRAL,
    lastTicks: {},
};

// --- QUANTITATIVE & HELPER FUNCTIONS (Moved from frontend services) ---
const calculateSMA = (data: ChartDataPoint[], period: number): number | null => {
    if (data.length < period) return null;
    const relevantData = data.slice(-period);
    const sum = relevantData.reduce((acc, point) => acc + point.price, 0);
    return sum / period;
};

const updateAlphaFactors = (symbol: StockSymbol, history: ChartDataPoint[], activeStrategy: HedgeFundStrategy) => {
    const calculateMomentum = (hist: ChartDataPoint[], period = 14): number => {
        if (hist.length < period) return 50;
        const roc = ((hist[hist.length - 1].price - hist[hist.length - period].price) / hist[hist.length - period].price) * 100;
        return Math.max(0, Math.min(100, 50 + (roc * 2.5)));
    };
    const calculateMeanReversion = (hist: ChartDataPoint[], period = 14): number => {
        if (hist.length < period) return 50;
        const changes = hist.slice(1).map((p, i) => p.price - hist[i].price);
        const recentChanges = changes.slice(-period);
        const gains = recentChanges.filter(c => c > 0).reduce((acc, c) => acc + c, 0);
        const losses = recentChanges.filter(c => c < 0).reduce((acc, c) => acc + Math.abs(c), 0);
        const avgGain = gains / period; const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 - (100 / (1 + rs)));
    };

    const currentFactors = state.alphaFactors[symbol] || { value: 75, momentum: 50, meanReversion: 50 };
    const newFactors: AlphaFactors = {
        value: Math.max(0, Math.min(100, currentFactors.value + (Math.random() - 0.5))),
        momentum: calculateMomentum(history),
        meanReversion: calculateMeanReversion(history),
        compositeAlphaScore: 0
    };
    let weights = { value: 0.3, momentum: 0.5, meanReversion: 0.2 }; // Default: Momentum
    if (activeStrategy === HedgeFundStrategy.MEAN_REVERSION) {
        weights = { value: 0.3, momentum: 0.2, meanReversion: 0.5 };
    }
    newFactors.compositeAlphaScore = newFactors.value * weights.value + newFactors.momentum * weights.momentum + newFactors.meanReversion * weights.meanReversion;
    state.alphaFactors[symbol] = newFactors;
    return newFactors;
};

const detectMarketRegime = (chartData: { [key in StockSymbol]: ChartDataPoint[] }): MarketRegime => {
    const stockDataArrays = Object.values(chartData).filter(arr => arr && arr.length > 0);
    if (stockDataArrays.length === 0 || stockDataArrays[0].length < 20) return MarketRegime.NEUTRAL;
    
    const historyLength = Math.min(...stockDataArrays.map(arr => arr.length));
    const avgMarketPrices: ChartDataPoint[] = [];
    for (let i = 0; i < historyLength; i++) {
        let sum = 0, count = 0;
        for (const stockData of stockDataArrays) {
            if (stockData[i]) { sum += stockData[i].price; count++; }
        }
        if (count > 0) avgMarketPrices.push({ time: stockDataArrays[0][i].time, price: sum / count });
    }

    const returns = avgMarketPrices.slice(1).map((p, i) => (p.price - avgMarketPrices[i].price) / avgMarketPrices[i].price);
    const volatility = Math.sqrt(returns.slice(-20).map(x => Math.pow(x - (returns.slice(-20).reduce((a, b) => a + b) / 20), 2)).reduce((a, b) => a + b) / 20) * 100;
    const shortMA = calculateSMA(avgMarketPrices, 5);
    const longMA = calculateSMA(avgMarketPrices, 20);
    let trendStrength = 0;
    if (shortMA && longMA && longMA > 0) trendStrength = Math.abs((shortMA - longMA) / longMA);

    if (trendStrength > 0.015) return MarketRegime.TRENDING;
    if (volatility > 0.8) return MarketRegime.RANGING;
    if (volatility < 0.3) return MarketRegime.LOW_VOLATILITY;
    return MarketRegime.NEUTRAL;
};

const updateMarketStatuses = () => {
    const now = new Date();
    const kstOffset = 9 * 60;
    const kstTime = new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);
    const kstHour = kstTime.getUTCHours();
    const kstDay = kstTime.getUTCDay();

    const etOffset = -4 * 60;
    const etTime = new Date(now.getTime() + (etOffset + now.getTimezoneOffset()) * 60000);
    const etHour = etTime.getUTCHours();
    const etMinute = etTime.getUTCMinutes();
    const etDay = etTime.getUTCDay();

    state.marketStatuses.KOREA = (kstDay > 0 && kstDay < 6 && kstHour >= 9 && (kstHour < 15 || (kstHour === 15 && kstTime.getUTCMinutes() <= 30))) ? 'OPEN' : 'CLOSED';
    state.marketStatuses.USA = (etDay > 0 && etDay < 6 && (etHour > 9 || (etHour === 9 && etMinute >= 30)) && etHour < 16) ? 'OPEN' : 'CLOSED';
};

// --- DISCORD WEBHOOK SERVICE ---
const sendDiscordNotification = async (embed: any) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'AI Trading Engine',
                avatar_url: 'https://i.imgur.com/4M34hi2.png',
                embeds: [embed],
            }),
        });
    } catch (error) { console.error("Discord Error:", error); }
};

// --- INITIALIZATION ---
const initializeServerState = async () => {
     for (const symbol in STOCKS) {
        const s = symbol as StockSymbol;
        state.alphaFactors[s] = { value: 75, momentum: 50, meanReversion: 50, compositeAlphaScore: 60 };
        state.fundamentalData[s] = { peRatio: 20, epsGrowth: 10, debtToEquity: 0.5 };
        state.chartData[s] = [];
        state.priceHistory[s] = [];
    }

    // Wrapped in try-catch to prevent server crash on init failure
    try {
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(now.getDate() - 30); // Fetch 30 days of data for backtesting

        for (const symbol of PUBLIC_SYMBOLS) {
            const ticker = YFINANCE_TICKERS[symbol]!;
            const intradayData = await yahooFinance.historical(ticker, {
                period1: startDate,
                interval: '15m' as any,
            });
            if (intradayData.length === 0) {
                console.warn(`Empty historical data for ${ticker}.`);
                continue;
            };

            const candlesticks = intradayData.filter(d => d.open && d.high && d.low && d.close).map(d => ({
                time: new Date(d.date).toLocaleString('sv-SE').replace(' ', 'T'), // ISO-like format
                open: d.open!, high: d.high!, low: d.low!, close: d.close!
            }));

            const prices = candlesticks.map(d => ({ time: d.time, price: d.close }));
            
            state.chartData[symbol] = candlesticks.slice(-200);
            state.priceHistory[symbol] = prices; // Store full history for backtesting
        }

        // Mock data for CXMT
        if (state.priceHistory[StockSymbol.NVIDIA]?.length > 0) {
            let price = 30;
            const cxmtHistory: ChartDataPoint[] = [];
            const baseTime = new Date(state.priceHistory[StockSymbol.NVIDIA][0].time).getTime();
            for (let i = 0; i < state.priceHistory[StockSymbol.NVIDIA].length; i++) {
                price *= (1 + (Math.random() - 0.5) * 0.02);
                const time = new Date(baseTime + i * 15 * 60000).toLocaleString('sv-SE').replace(' ', 'T');
                cxmtHistory.push({ time, price });
            }
            state.priceHistory[StockSymbol.CXMT] = cxmtHistory;
        }

    } catch (error) {
        console.error("Error initializing server state with historical data:", error);
        // This throw will be caught by the server start logic, preventing a crash.
        throw new Error("Failed to initialize historical market data.");
    }
};


// --- CORE SERVER LOGIC ---
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// --- HELPER FUNCTIONS FOR BANK & TRADES (REAL-TIME) ---
const bankAction = (type: 'deposit' | 'withdraw', amount: number) => {
    if (amount <= 0) return { success: false, newBalance: state.bank.balance, message: 'Amount must be positive.' };
    if (type === 'withdraw' && state.bank.balance < amount) return { success: false, newBalance: state.bank.balance, message: 'Insufficient bank funds.' };
    
    state.bank.balance += (type === 'deposit' ? amount : -amount);
    const transaction: BankTransaction = { id: `tx_${Date.now()}`, timestamp: new Date().toLocaleTimeString(), type: type === 'deposit' ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL, amount };
    state.bank.transactions.unshift(transaction);
    if(state.bank.transactions.length > 20) state.bank.transactions.pop();
    return { success: true, newBalance: state.bank.balance, transaction };
};
const depositToBank = (amount: number) => bankAction('deposit', amount);
const withdrawFromBank = (amount: number) => bankAction('withdraw', amount);

const executeTrade = (order: { symbol: StockSymbol, action: TradeAction, shares: number, price: number }): OrderConfirmation => {
    const { symbol, action, shares, price } = order;
    const totalCost = shares * price;
    const isUSD = STOCKS[symbol].currency === Currency.USD;
    const costInKrw = isUSD ? totalCost * state.exchangeRate : totalCost;

    if ((action === 'BUY' || action === 'COVER') && state.portfolio.cash < costInKrw) {
        const needed = costInKrw - state.portfolio.cash;
        const withdrawResult = withdrawFromBank(needed);
        if (!withdrawResult.success) return { ...order, orderId: `ord_${Date.now()}`, filledPrice: price, timestamp: Date.now(), status: 'FAILED', reason: 'Insufficient funds in portfolio and bank' };
        state.portfolio.cash += needed;
    }

    state.portfolio.cash -= costInKrw * (action === 'BUY' || action === 'COVER' ? 1 : -1);
    
    const existing = state.portfolio.holdings[symbol];
    if (existing) {
        if (action === 'BUY') {
            const newTotalShares = existing.shares + shares;
            existing.avgPrice = ((existing.avgPrice * existing.shares) + totalCost) / newTotalShares;
            existing.shares = newTotalShares;
        } else if (action === 'SELL') {
            existing.shares -= shares;
            if(existing.shares <= 0) delete state.portfolio.holdings[symbol];
        }
    } else if (action === 'BUY') {
        state.portfolio.holdings[symbol] = { shares, avgPrice: price, positionType: PositionType.LONG };
    }
    
    return { ...order, orderId: `ord_${Date.now()}`, filledPrice: price, timestamp: Date.now(), status: 'SUCCESS' };
};

// --- REFACTORED AI LOGIC FUNCTIONS ---
async function generateCioStrategy(regime: MarketRegime, portfolioValue: number, isAggressiveMode: boolean, isLowLatencyMode: boolean): Promise<{ strategy: HedgeFundStrategy; reason: string; }> {
    const prompt = `You are a CIO of a quantitative hedge fund. Select the single most appropriate strategy from the list based on the provided market conditions.
    Available Strategies: ${Object.values(HedgeFundStrategy).join(', ')}.
    Current Conditions: - Regime: "${regime}" - Portfolio Value (KRW): ${Math.round(portfolioValue).toLocaleString()} - Mode: ${isAggressiveMode ? 'Aggressive' : 'Normal'}
    Guidelines: - Trending: Use 'Alpha Momentum' or 'Jocoding's Simple MA Cross'. - Ranging: Use 'Mean Reversion' or 'Pairs Trading'. - Volatile Ranging: Use 'Deep Hedging (ML)'. - Unclear: Use 'Risk Off'.
    Provide a concise, one-sentence reason. Respond ONLY with a valid JSON object.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash", contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: { strategy: { type: Type.STRING, enum: Object.values(HedgeFundStrategy) }, reason: { type: Type.STRING } }, required: ["strategy", "reason"] },
                ...(isLowLatencyMode && { thinkingConfig: { thinkingBudget: 0 } })
            }
        });
        const text = response.text.trim();
        if (!text) throw new Error("Received empty response from AI model.");
        return JSON.parse(text);
    } catch (error) {
        console.error("CIO Strategy AI Error:", error);
        return { strategy: HedgeFundStrategy.RISK_OFF, reason: "AI API Error. Defaulting to safety." };
    }
}

async function generateTradeSignal(stock: Stock, activeStrategy: HedgeFundStrategy, factors: AlphaFactors, trend: Trend, fundamentals: FundamentalData, isAggressiveMode: boolean, isLowLatencyMode: boolean): Promise<AITradeSignal> {
    const prompt = `You are a Quantitative Analyst. Provide a trade signal for ${stock.name} (${stock.symbol}).
    - Strategy: ${activeStrategy} - Factors: Value=${factors.value.toFixed(1)}, Momentum=${factors.momentum.toFixed(1)}, Mean Reversion=${factors.meanReversion.toFixed(1)}, Composite=${factors.compositeAlphaScore.toFixed(1)}
    - Context: Trend is ${trend}. P/E=${fundamentals.peRatio.toFixed(1)}, EPS Growth=${fundamentals.epsGrowth.toFixed(1)}%. - Mode: ${isAggressiveMode ? 'Aggressive' : 'Normal'}
    Your task:
    1.  'decision': Must be 'BUY', 'SELL', or 'HOLD'.
    2.  'sharesToTrade': Must be an integer. 0 for 'HOLD'. Aggressive: ~50 shares, Normal: ~20 shares.
    3.  'confidence': Must be a number between 0.5 and 1.0.
    4.  'reason': A concise justification.
    Respond ONLY with a valid JSON object.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash", contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: { decision: { type: Type.STRING, enum: [TradeAction.BUY, TradeAction.SELL, TradeAction.HOLD] }, reason: { type: Type.STRING }, sharesToTrade: { type: Type.INTEGER }, confidence: { type: Type.NUMBER } }, required: ["decision", "reason", "sharesToTrade", "confidence"] },
                ...(isLowLatencyMode && { thinkingConfig: { thinkingBudget: 0 } })
            }
        });
        const text = response.text.trim();
        if (!text) throw new Error("Received empty response from AI model.");
        const signal = JSON.parse(text);
        if (signal.decision !== 'HOLD') {
            sendDiscordNotification({ title: `🤖 AI Analyst Signal: ${signal.decision} ${stock.koreanName}`, description: `**Reason**: ${signal.reason}`, color: 3447003, fields: [{ name: 'Strategy', value: activeStrategy }, { name: 'Confidence', value: `${(signal.confidence * 100).toFixed(1)}%` }] });
        }
        return signal;
    } catch (error) {
        console.error("Trade Signal AI Error:", error);
        return { decision: TradeAction.HOLD, reason: 'AI Analyst API Error', sharesToTrade: 0, confidence: 0 };
    }
}

async function generateMlSignal(stock: Stock, features: MlFeatures, isLowLatencyMode: boolean): Promise<AITradeSignal> {
    const prompt = `You are emulating an ML model for short-term price prediction for ${stock.name}.
    Input Features: - priceChange5m: ${features.priceChange5m.toFixed(2)}% - priceChange20m: ${features.priceChange20m.toFixed(2)}% - volatility10m: ${features.volatility10m.toFixed(2)}% - rsi14m: ${features.rsi14m.toFixed(1)}
    Your task:
    1.  'decision': 'BUY', 'SELL', or 'HOLD'. High positive price change/RSI suggests 'SELL' (reversion). Sustained change suggests 'BUY'. Low volatility suggests 'HOLD'.
    2.  'softmaxProbabilities': JSON object with keys "buy", "sell", "hold". Their values must sum to 1.0. The 'decision' must match the highest probability.
    3.  Set 'sharesToTrade' to 30 for BUY/SELL, 0 for HOLD.
    4.  Set 'confidence' to the highest probability value.
    5.  'reason': A concise technical reason based on features.
    Respond ONLY with a valid JSON object.`;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash", contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: { decision: { type: Type.STRING, enum: [TradeAction.BUY, TradeAction.SELL, TradeAction.HOLD] }, reason: { type: Type.STRING }, sharesToTrade: { type: Type.INTEGER }, confidence: { type: Type.NUMBER }, softmaxProbabilities: { type: Type.OBJECT, properties: { buy: { type: Type.NUMBER }, sell: { type: Type.NUMBER }, hold: { type: Type.NUMBER } }, required: ["buy", "sell", "hold"] } }, required: ["decision", "reason", "sharesToTrade", "confidence", "softmaxProbabilities"] },
                ...(isLowLatencyMode && { thinkingConfig: { thinkingBudget: 0 } })
            }
        });
        const text = response.text.trim();
        if (!text) throw new Error("Received empty response from AI model.");
        return JSON.parse(text);
    } catch (error) {
        console.error("ML Signal AI Error:", error);
        return { decision: TradeAction.HOLD, reason: "ML Inference API Error", sharesToTrade: 0, confidence: 0, softmaxProbabilities: { buy: 0, sell: 0, hold: 1 } };
    }
}


// --- API ENDPOINTS ---
app.get('/api/initial-chart-data', (req: Request, res: Response) => res.json(state.chartData));
app.get('/api/bank-data', (req: Request, res: Response) => res.json(state.bank));
app.get('/api/portfolio', (req: Request, res: Response) => res.json(state.portfolio));
app.get('/api/latest-ticks', (req: Request, res: Response) => res.json(state.lastTicks));
app.get('/api/server-state', (req: Request, res: Response) => res.json({ exchangeRate: state.exchangeRate, marketStatuses: state.marketStatuses, fundamentalData: state.fundamentalData, alphaFactors: state.alphaFactors, marketRegime: state.marketRegime }));
app.post('/api/bank-withdraw', (req: Request, res: Response) => res.json(withdrawFromBank(req.body.amount)));
app.post('/api/bank-deposit', (req: Request, res: Response) => res.json(depositToBank(req.body.amount)));
app.post('/api/execute-trade', (req: Request, res: Response) => res.json(executeTrade(req.body)));

// AI Endpoints with added error handling
app.post('/api/cio-strategy', async (req: Request, res: Response) => {
    try {
        const result = await generateCioStrategy(req.body.regime, req.body.portfolioValue, req.body.isAggressiveMode, req.body.isLowLatencyMode);
        res.json(result);
    } catch (error) {
        console.error(`[API ERROR] /api/cio-strategy:`, error);
        res.status(500).json({ message: "Failed to get CIO strategy", details: (error as Error).message });
    }
});
app.post('/api/trade-signal', async (req: Request, res: Response) => {
    try {
        const result = await generateTradeSignal(req.body.stock, req.body.activeStrategy, req.body.factors, req.body.trend, req.body.fundamentals, req.body.isAggressiveMode, req.body.isLowLatencyMode);
        res.json(result);
    } catch (error) {
        console.error(`[API ERROR] /api/trade-signal:`, error);
        res.status(500).json({ message: "Failed to get trade signal", details: (error as Error).message });
    }
});
app.post('/api/ml-signal', async (req: Request, res: Response) => {
    try {
        const result = await generateMlSignal(req.body.stock, req.body.features, req.body.isLowLatencyMode);
        res.json(result);
    } catch (error) {
        console.error(`[API ERROR] /api/ml-signal:`, error);
        res.status(500).json({ message: "Failed to get ML signal", details: (error as Error).message });
    }
});

// --- BACKTESTING ENDPOINT ---
app.post('/api/backtest', async (req: Request, res: Response) => {
    try {
        const { strategy, initialCapital } = req.body;
        // Ensure historical data is loaded before running backtest
        if (Object.keys(state.priceHistory).length === 0 || state.priceHistory[PUBLIC_SYMBOLS[0]].length === 0) {
            return res.status(400).json({ message: "Historical data not yet available. Please wait a moment and try again." });
        }
        const results = await runBacktest(strategy, initialCapital, state.priceHistory);
        res.json(results);
    } catch (error) {
        console.error("Backtest Error:", error);
        res.status(500).json({ message: "Backtest failed", error: (error as Error).message });
    }
});


// --- REAL-TIME ENGINE & SERVER START ---
io.on('connection', (socket) => { console.log('Client connected via WebSocket'); socket.on('disconnect', () => console.log('Client disconnected')); });

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initializeServerState()
        .then(() => {
            console.log("Server state initialized successfully.");
            // Simplified market simulation loop
            setInterval(() => {
                updateMarketStatuses();
                state.exchangeRate += (Math.random() - 0.5) * 0.5;
                for (const symbol of Object.keys(STOCKS) as StockSymbol[]) {
                    const stockCurrency = STOCKS[symbol].currency;
                    const market = stockCurrency === 'KRW' ? 'KOREA' : 'USA';
                    if (state.marketStatuses[market] === 'OPEN') {
                        const history = state.priceHistory[symbol];
                        if (history && history.length > 0) {
                            const lastPrice = history[history.length - 1].price;
                            const newPrice = lastPrice * (1 + (Math.random() - 0.5) * 0.005);
                            const tick: LiveTick = { symbol, price: newPrice, timestamp: Date.now() };
                            io.emit('market_tick', tick);
                            state.lastTicks[symbol] = tick;
                            history.push({ time: new Date(tick.timestamp).toLocaleTimeString([], { hour12: false }), price: newPrice });
                            if(history.length > 2000) history.shift();

                            updateAlphaFactors(symbol, history, HedgeFundStrategy.ALPHA_MOMENTUM);
                        }
                    }
                }
                state.marketRegime = detectMarketRegime(state.priceHistory);
            }, 2000);
        })
        .catch(error => {
            console.error("FATAL: Failed to initialize server state. The server may not function correctly.", error);
        });
});


// --- BACKTESTING ENGINE ---
async function runBacktest(strategy: HedgeFundStrategy, initialCapital: number, historicalData: { [key in StockSymbol]: ChartDataPoint[] }): Promise<BacktestResult> {
    const simPortfolio: Portfolio = { cash: initialCapital, holdings: {}, pairTrades: {} };
    const equityCurve: EquityDataPoint[] = [];
    const tradeLog: BacktestTradeLogEntry[] = [];
    let profitableTrades = 0;
    
    // Combine all price data into a single timeline
    const timeline: { [time: string]: { [key in StockSymbol]?: number } } = {};
    Object.entries(historicalData).forEach(([symbol, data]) => {
        data.forEach(point => {
            if (!timeline[point.time]) timeline[point.time] = {};
            timeline[point.time][symbol as StockSymbol] = point.price;
        });
    });
    const sortedTimes = Object.keys(timeline).sort();

    const currentPrices: { [key in StockSymbol]?: number } = {};

    for (const time of sortedTimes) {
        // Update current prices
        Object.assign(currentPrices, timeline[time]);

        const historySlice: { [key in StockSymbol]: ChartDataPoint[] } = {} as any;
        Object.keys(STOCKS).forEach(s => {
            const symbol = s as StockSymbol;
            const fullHistory = historicalData[symbol];
            if (!fullHistory) return;
            const currentIndex = fullHistory.findIndex(p => p.time === time);
            historySlice[symbol] = fullHistory.slice(0, currentIndex + 1);
        });

        // Run strategy logic
        for (const symbol of Object.keys(STOCKS) as StockSymbol[]) {
             if (!historySlice[symbol] || historySlice[symbol].length < 21 || !currentPrices[symbol]) continue;

            let signal: AITradeSignal | null = null;
            if (strategy === HedgeFundStrategy.JOCODING_MA_CROSS) {
                const techSignal = getMovingAverageCrossSignal(historySlice[symbol]);
                if (techSignal) {
                    signal = { decision: techSignal.action, sharesToTrade: 10, confidence: 0.9, reason: techSignal.reason };
                }
            } else if (strategy === HedgeFundStrategy.DEEP_HEDGING) {
                signal = await generateMlSignal(STOCKS[symbol], extractFeaturesFromData(historySlice[symbol]), true); // Low latency true for backtest speed
            } else if (strategy === HedgeFundStrategy.ALPHA_MOMENTUM || strategy === HedgeFundStrategy.MEAN_REVERSION) {
                const factors = updateAlphaFactors(symbol, historySlice[symbol], strategy);
                const trend: Trend = 'NEUTRAL'; // Simplified for backtest
                signal = await generateTradeSignal(STOCKS[symbol], strategy, factors, trend, state.fundamentalData[symbol], false, true); // Low latency true
            }

            // Execute Trade in Simulation
            if (signal && signal.decision !== TradeAction.HOLD && signal.sharesToTrade > 0) {
                const price = currentPrices[symbol]!;
                const cost = price * signal.sharesToTrade;
                const existing = simPortfolio.holdings[symbol];

                if (signal.decision === TradeAction.BUY && simPortfolio.cash >= cost) {
                    simPortfolio.cash -= cost;
                    const newShares = (existing?.shares || 0) + signal.sharesToTrade;
                    const newAvgPrice = existing ? ((existing.avgPrice * existing.shares) + cost) / newShares : price;
                    simPortfolio.holdings[symbol] = { shares: newShares, avgPrice: newAvgPrice, positionType: PositionType.LONG };
                    tradeLog.push({ id: `t_${time}_${symbol}`, timestamp: time, stock: STOCKS[symbol], action: TradeAction.BUY, price, shares: signal.sharesToTrade, cost });
                } else if (signal.decision === TradeAction.SELL && existing && existing.shares > 0) {
                    const sharesToSell = Math.min(existing.shares, signal.sharesToTrade);
                    simPortfolio.cash += price * sharesToSell;
                    const pnl = (price - existing.avgPrice) * sharesToSell;
                    if(pnl > 0) profitableTrades++;
                    existing.shares -= sharesToSell;
                    if (existing.shares === 0) delete simPortfolio.holdings[symbol];
                    tradeLog.push({ id: `t_${time}_${symbol}`, timestamp: time, stock: STOCKS[symbol], action: TradeAction.SELL, price, shares: sharesToSell, cost: price * sharesToSell, pnl });
                }
            }
        }
        
        // Record equity
        const holdingsValue = Object.entries(simPortfolio.holdings).reduce((acc, [s, h]) => acc + (currentPrices[s as StockSymbol] || 0) * h.shares, 0);
        equityCurve.push({ time, value: simPortfolio.cash + holdingsValue });
    }

    // Calculate Metrics
    const finalValue = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].value : initialCapital;
    const totalReturn = (finalValue - initialCapital) / initialCapital;
    const closedTrades = tradeLog.filter(t => t.action === TradeAction.SELL || t.action === TradeAction.COVER);
    const winRate = closedTrades.length > 0 ? profitableTrades / closedTrades.length : 0;
    
    // Sharpe Ratio
    const returns = equityCurve.length > 1 ? equityCurve.slice(1).map((v, i) => (v.value - equityCurve[i].value) / equityCurve[i].value) : [];
    const avgReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
    const stdDev = returns.length > 0 ? Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((s, v) => s + v, 0) / returns.length) : 0;
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252 * (24 * 4)) : 0; // Annualized for 15m intervals

    // Max Drawdown
    let peak = -Infinity;
    let maxDrawdown = 0;
    equityCurve.forEach(p => {
        if (p.value > peak) peak = p.value;
        const drawdown = (peak - p.value) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    const metrics: BacktestMetrics = {
        finalValue, totalReturn, sharpeRatio, maxDrawdown, winRate, totalTrades: closedTrades.length
    };

    return { metrics, equityCurve, tradeLog };
}
