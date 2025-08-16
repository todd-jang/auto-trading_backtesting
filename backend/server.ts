
import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import yahooFinance from 'yahoo-finance2';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

import { 
    Stock,
    StockSymbol, CandlestickDataPoint, LiveTick, Currency, Portfolio, BankTransaction, 
    TradeAction, PositionType, PairTrade, MarketRegime, HedgeFundStrategy, AlphaFactors, 
    FundamentalData, Trend, OrderConfirmation, TransactionType, ChartDataPoint, AITradeSignal, MlFeatures 
} from '../types';
import { STOCKS } from '../constants';

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

    const currentFactors = state.alphaFactors[symbol];
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
};

const detectMarketRegime = (chartData: { [key in StockSymbol]: ChartDataPoint[] }): MarketRegime => {
    const stockDataArrays = Object.values(chartData);
    if (stockDataArrays.length === 0 || stockDataArrays[0].length < 20) return MarketRegime.NEUTRAL;
    
    const historyLength = stockDataArrays[0].length;
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
    const kstOffset = 9 * 60; // KST is UTC+9
    const kstTime = new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);
    const kstHour = kstTime.getUTCHours();
    const kstDay = kstTime.getUTCDay();

    const etOffset = -4 * 60; // ET is UTC-4 (with DST)
    const etTime = new Date(now.getTime() + (etOffset + now.getTimezoneOffset()) * 60000);
    const etHour = etTime.getUTCHours();
    const etMinute = etTime.getUTCMinutes();
    const etDay = etTime.getUTCDay();

    state.marketStatuses.KOREA = (kstDay > 0 && kstDay < 6 && kstHour >= 9 && kstHour < 16) ? 'OPEN' : 'CLOSED';
    if(kstHour === 15 && kstTime.getUTCMinutes() > 30) state.marketStatuses.KOREA = 'CLOSED';


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

    try {
        const now = new Date();

        for (const symbol of PUBLIC_SYMBOLS) {
            const ticker = YFINANCE_TICKERS[symbol]!;
            let candlesticks: CandlestickDataPoint[];
            
            try {
                const startDate = new Date();
                startDate.setDate(now.getDate() - 5);
                const intradayData = await yahooFinance.historical(ticker, {
                    period1: startDate,
                    interval: '5m' as any,
                });
                if (intradayData.length === 0) throw new Error("Empty intraday data from Yahoo Finance");

                candlesticks = intradayData.filter(d => d.open && d.high && d.low && d.close).map(d => ({
                    time: d.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                    open: d.open!, high: d.high!, low: d.low!, close: d.close!
                }));
                console.log(`Successfully fetched ${candlesticks.length} 5m data points for ${ticker}.`);

            } catch (e) {
                console.warn(`Could not fetch 5m data for ${ticker}, falling back to daily. Reason: ${e instanceof Error ? e.message : String(e)}`);
                const dailyStartDate = new Date();
                dailyStartDate.setDate(now.getDate() - 90);
                const dailyData = await yahooFinance.historical(ticker, { period1: dailyStartDate, interval: '1d' });

                candlesticks = dailyData.filter(d => d.open && d.high && d.low && d.close).map(d => ({
                    time: d.date.toISOString().split('T')[0], // Use YYYY-MM-DD
                    open: d.open!, high: d.high!, low: d.low!, close: d.close!
                }));
                 console.log(`Fetched ${candlesticks.length} daily data points for ${ticker} as fallback.`);
            }
            
            const prices = candlesticks.map(d => ({ time: d.time, price: d.close }));
            
            state.chartData[symbol] = candlesticks.slice(-200); // Cap candlesticks to keep initial payload reasonable
            state.priceHistory[symbol] = prices.slice(-500);
        }

        // Mock data for CXMT
        let price = 30;
        const cxmtHistory: CandlestickDataPoint[] = [];
        for (let i = 0; i < 200; i++) {
            const open = price;
            const close = open * (1 + (Math.random() - 0.5) * 0.02);
            price = close;
            const high = Math.max(open, close) * (1 + Math.random() * 0.01);
            const low = Math.min(open, close) * (1 - Math.random() * 0.01);
            const time = new Date(Date.now() - (200 - i) * 5 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            cxmtHistory.push({ time, open, high, low, close });
        }
        state.chartData[StockSymbol.CXMT] = cxmtHistory;
        state.priceHistory[StockSymbol.CXMT] = cxmtHistory.map(d => ({ time: d.time, price: d.close })).slice(-500);

    } catch (error) {
        console.error("Error initializing server state with historical data:", error);
    }
};


// --- CORE SERVER LOGIC ---
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());


// --- API ENDPOINTS ---
app.get('/api/initial-chart-data', (req: Request, res: Response) => res.json(state.chartData));
app.get('/api/bank-data', (req: Request, res: Response) => res.json(state.bank));
app.get('/api/portfolio', (req: Request, res: Response) => res.json(state.portfolio));
app.get('/api/latest-ticks', (req: Request, res: Response) => res.json(state.lastTicks));
app.get('/api/server-state', (req: Request, res: Response) => {
    res.json({
        exchangeRate: state.exchangeRate,
        marketStatuses: state.marketStatuses,
        fundamentalData: state.fundamentalData,
        alphaFactors: state.alphaFactors,
        marketRegime: state.marketRegime,
    });
});
app.post('/api/bank-withdraw', (req: Request, res: Response) => res.json(withdrawFromBank(req.body.amount)));
app.post('/api/bank-deposit', (req: Request, res: Response) => res.json(depositToBank(req.body.amount)));
app.post('/api/execute-trade', (req: Request, res: Response) => res.json(executeTrade(req.body)));


// --- AI API ENDPOINTS ---
app.post('/api/cio-strategy', async (req: Request, res: Response) => {
    const { regime, portfolioValue, isAggressiveMode, isLowLatencyMode } = req.body;
    const prompt = `You are the Chief Investment Officer (CIO) of a quantitative hedge fund specializing in the semiconductor sector. Your task is to select the single most appropriate strategy from the list based on the provided market conditions.
    Available Strategies: ${Object.values(HedgeFundStrategy).join(', ')}.
    Current Market Conditions:
    - Market Regime: "${regime}"
    - Total Portfolio Value (KRW): ${Math.round(portfolioValue).toLocaleString()}
    - Investor Mode: ${isAggressiveMode ? 'Aggressive' : 'Normal'}
    - Latency Mode: ${isLowLatencyMode ? 'Low Latency (prioritize speed)' : 'High Quality (prioritize accuracy)'}
    
    Guidelines:
    - In a 'Trending Market', 'Alpha Momentum' or 'Jocoding's Simple MA Cross' are strong choices.
    - In a 'Ranging Market', 'Mean Reversion' or 'Pairs Trading' are suitable.
    - 'Deep Hedging (ML)' is best for high volatility 'Ranging' markets.
    - 'Risk Off' is the only acceptable choice if the market is chaotic or presents no clear opportunities.
    - If in 'Low Latency Mode', prefer simpler, faster strategies like 'Jocoding's Simple MA Cross'.
    - If in 'Aggressive Mode', you can take on more risk with momentum or ML strategies.

    Provide a concise, one-sentence reason for your choice. Your response must be a JSON object.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strategy: { type: Type.STRING, enum: Object.values(HedgeFundStrategy) },
                        reason: { type: Type.STRING }
                    },
                    required: ["strategy", "reason"]
                },
                 ...(isLowLatencyMode && { thinkingConfig: { thinkingBudget: 0 } })
            }
        });
        res.json(JSON.parse(response.text));
    } catch (error) {
        console.error("CIO Strategy AI Error:", error);
        res.status(500).json({ strategy: HedgeFundStrategy.RISK_OFF, reason: "AI API Error. Defaulting to safety." });
    }
});

app.post('/api/trade-signal', async (req: Request, res: Response) => {
    const { stock, activeStrategy, factors, trend, fundamentals, isAggressiveMode, isLowLatencyMode } = req.body;
    const prompt = `You are a Senior Quantitative Analyst specializing in semiconductor stocks. Provide a trade signal based on the data.
    - Stock: ${stock.name} (${stock.symbol})
    - Active Strategy: ${activeStrategy}
    - Quant Factors: Value=${factors.value.toFixed(1)}, Momentum=${factors.momentum.toFixed(1)}, Mean Reversion=${factors.meanReversion.toFixed(1)}, Composite Alpha=${factors.compositeAlphaScore.toFixed(1)}
    - Market Context: Short-term trend is ${trend}.
    - Fundamentals: P/E=${fundamentals.peRatio.toFixed(1)}, EPS Growth=${fundamentals.epsGrowth.toFixed(1)}%, Debt/Equity=${fundamentals.debtToEquity.toFixed(2)}
    - Investor Mode: ${isAggressiveMode ? 'Aggressive' : 'Normal'}
    
    Analyze the data in the context of the active strategy. For example, if the strategy is 'Alpha Momentum', a high momentum score is very important. If 'Mean Reversion', a low Mean Reversion score (indicating overbought) is a signal to sell.
    Determine a 'decision' (BUY, SELL, HOLD, SHORT, COVER). 'sharesToTrade' should be a round number (e.g., 10, 20, 50), higher if aggressive. Provide a 'confidence' score (0.5 to 1.0) and a concise 'reason'.
    You must return a JSON object.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        decision: { type: Type.STRING, enum: Object.values(TradeAction) },
                        reason: { type: Type.STRING },
                        sharesToTrade: { type: Type.INTEGER },
                        confidence: { type: Type.NUMBER }
                    },
                    required: ["decision", "reason", "sharesToTrade", "confidence"]
                },
                ...(isLowLatencyMode && { thinkingConfig: { thinkingBudget: 0 } })
            }
        });
        const signal = JSON.parse(response.text);
        if(signal.decision !== 'HOLD') {
            sendDiscordNotification({ title: `🤖 AI Analyst Signal: ${signal.decision} ${stock.koreanName}`, description: `**Reason**: ${signal.reason}`, color: 3447003, fields: [{name: 'Strategy', value: activeStrategy}, {name: 'Confidence', value: `${(signal.confidence*100).toFixed(1)}%`}] });
        }
        res.json(signal);
    } catch (error) {
        console.error("Trade Signal AI Error:", error);
        res.status(500).json({ decision: 'HOLD', reason: 'AI Analyst API Error', sharesToTrade: 0, confidence: 0 });
    }
});

app.post('/api/ml-signal', async (req: Request, res: Response) => {
    const { stock, features, isLowLatencyMode } = req.body as { stock: Stock, features: MlFeatures, isLowLatencyMode: boolean};
    const prompt = `You are an AI emulating a trained Machine Learning model for short-term price prediction on semiconductor stocks.
    Input Features for ${stock.name}:
    - priceChange5m: ${features.priceChange5m.toFixed(2)}%
    - priceChange20m: ${features.priceChange20m.toFixed(2)}%
    - volatility10m: ${features.volatility10m.toFixed(2)}%
    - rsi14m: ${features.rsi14m.toFixed(1)}

    Based on these features, output a trade decision. High positive price change and high RSI suggest a 'SELL' (mean reversion). Strong sustained price change suggests 'BUY'. Low volatility suggests 'HOLD'.
    Also provide softmax probabilities for BUY, SELL, and HOLD. The decision should correspond to the highest probability. The sum of probabilities must be 1.0.
    Provide a concise technical 'reason'.
    Return a JSON object.`;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: