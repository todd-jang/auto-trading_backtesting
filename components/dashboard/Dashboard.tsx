import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StockSymbol, Portfolio, Activity, TradeAction, NormalizedChartDataPoint, Currency, AnalysisFocus, AlphaFactors, Trend, HedgeFundStrategy, MarketRegime, Stock, CandlestickDataPoint, ChartDataPoint, LiveTick, OrderConfirmation, BankTransaction, PositionType, FundamentalData, AITradeSignal, PairTrade, PairsTradingSignal } from '../../types';
import { STOCKS } from '../../constants';
import { getStrategicAllocation, getAiTradeSignal, getMlInferenceSignal } from '../../services/geminiService';
import { getExchangeRate } from '../../services/exchangeRateService';
import { initializeAlphaFactors, getUpdatedAlphaFactors } from '../../services/alphaFactorService';
import { initializeFundamentalData, getUpdatedFundamentalData } from '../../services/fundamentalService';
import { calculateSMA } from '../../services/movingAverage';
import { getPairsTradingSignal } from '../../services/pairsTradingService';
import { getMovingAverageCrossSignal, SHORT_MA_PERIOD, LONG_MA_PERIOD } from '../../services/technicalAnalysisService';
import { detectMarketRegime } from '../../services/marketRegimeService';
import { marketDataService, isMarketOpen } from '../../services/marketDataService';
import { extractFeaturesFromData } from '../../services/mlService';
import { executeLiveTrade } from '../../services/tradingExecutionService';
import { virtualBankService } from '../../services/virtualBankService';
import { sendTradeNotification } from '../../services/discordWebhookService';
import ControlPanel from './ControlPanel';
import CombinedStockChart from './CombinedStockChart';
import PortfolioSummary from './PortfolioSummary';
import ActivityLog from './ActivityLog';
import AiAnalysisFactors from './AiAnalysisFactors';
import IndividualCharts from './IndividualCharts';
import VirtualBank from './VirtualBank';

const AGGREGATION_INTERVAL = 5000; // 5 seconds to create a new candle
const PAIRS_TRADE_VALUE_KRW = 2_000_000; // Value per leg of a pairs trade
const TRADING_LOOP_INTERVAL = 5000; // 5 seconds for main decision loop

const initialChartData = marketDataService.getInitialData();

type MarketStatus = 'OPEN' | 'CLOSED';

const Dashboard: React.FC = () => {
    const [isEngineRunning, setIsEngineRunning] = useState<boolean>(false);
    const [isAggressiveMode, setIsAggressiveMode] = useState<boolean>(false);
    const [isLowLatencyMode, setIsLowLatencyMode] = useState<boolean>(false);
    
    const priceHistoryRef = useRef<{ [key in StockSymbol]: ChartDataPoint[] }>({} as { [key in StockSymbol]: ChartDataPoint[] });
    const lastTickRef = useRef<{ [key in StockSymbol]?: LiveTick }>({});
    const candleAggregatorRef = useRef<{ [key in StockSymbol]?: {open: number, high: number, low: number, close: number, time: string} }>({});
    const setupComplete = useRef(false);

    const [chartData, setChartData] = useState<{ [key in StockSymbol]: CandlestickDataPoint[] }>(initialChartData);
    const [normalizedChartData, setNormalizedChartData] = useState<NormalizedChartDataPoint[]>([]);
    const [currentPrices, setCurrentPrices] = useState<{ [key in StockSymbol]: number }>(() => {
         return (Object.keys(STOCKS) as StockSymbol[]).reduce((acc, symbol) => {
            const data = initialChartData[symbol];
            acc[symbol] = data && data.length > 0 ? data[data.length - 1].close : 0;
            return acc;
        }, {} as { [key in StockSymbol]: number });
    });

    const [portfolio, setPortfolio] = useState<Portfolio>({
        cash: 0,
        holdings: {},
        pairTrades: {},
    });
    const [bankBalance, setBankBalance] = useState<number>(() => virtualBankService.getBalance());
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(() => virtualBankService.getTransactions());

    const [activityLog, setActivityLog] = useState<Activity[]>([]);
    const [exchangeRate, setExchangeRate] = useState<number>(1380);
    const [alphaFactors, setAlphaFactors] = useState<{ [key in StockSymbol]: AlphaFactors }>(initializeAlphaFactors());
    const [fundamentalData, setFundamentalData] = useState<{ [key in StockSymbol]: FundamentalData }>(initializeFundamentalData());
    
    const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisFocus | null>(null);
    const [currentAnalystSignal, setCurrentAnalystSignal] = useState<AITradeSignal | null>(null);
    const [mlSignals, setMlSignals] = useState<{ [key in StockSymbol]?: AITradeSignal }>({});

    const [liveTime, setLiveTime] = useState(new Date());
    const [marketRegime, setMarketRegime] = useState<MarketRegime>(MarketRegime.NEUTRAL);
    const [activeStrategy, setActiveStrategy] = useState<HedgeFundStrategy>(HedgeFundStrategy.RISK_OFF);
    const [strategyReason, setStrategyReason] = useState("");
    const [pairsSignal, setPairsSignal] = useState<string | null>(null);
    const [marketStatuses, setMarketStatuses] = useState<{ [market: string]: MarketStatus }>({ KOREA: 'CLOSED', USA: 'CLOSED' });
    
    useEffect(() => {
        if (setupComplete.current) return;
        setupComplete.current = true;

        for (const symbol in initialChartData) {
            priceHistoryRef.current[symbol as StockSymbol] = initialChartData[symbol as StockSymbol].map(d => ({ time: d.time, price: d.close }));
        }
        
        const initialFunding = async () => {
            const initialTradingCash = 5_000_000;
            const result = await virtualBankService.withdraw(initialTradingCash);
            if (result.success && result.transaction) {
                setPortfolio(p => ({...p, cash: p.cash + result.transaction!.amount }));
                setBankBalance(result.newBalance);
                setBankTransactions(prev => [result.transaction!, ...prev]);
            }
        };
        initialFunding();
        
        const clockInterval = setInterval(() => setLiveTime(new Date()), 1000);
        return () => clearInterval(clockInterval);
    }, []);

    const logActivity = useCallback((action: TradeAction, stock: Stock, shares: number, price: number, reason: string, confidence?: number) => {
        const roundedTime = new Date(Math.floor(Date.now() / AGGREGATION_INTERVAL) * AGGREGATION_INTERVAL).toLocaleTimeString([], { hour12: false });
        
        const newActivity: Activity = {
            id: new Date().toISOString() + Math.random(),
            timestamp: new Date().toLocaleTimeString([], { hour12: false }),
            action, stock, shares, price, reason,
            time: roundedTime,
            confidence,
        };
        setActivityLog(prev => [newActivity, ...prev.slice(0, 199)]);
    }, []);

    const processTradeExecution = useCallback(async (stock: Stock, signal: AITradeSignal, activeStrategy: HedgeFundStrategy, isPairTradeLeg: boolean = false) => {
        if (signal.decision === TradeAction.HOLD || signal.sharesToTrade <= 0) return;
    
        if (!isPairTradeLeg) {
            await sendTradeNotification(signal, activeStrategy, currentPrices[stock.symbol], stock);
        }

        const currentPrice = currentPrices[stock.symbol];
    
        if (!isPairTradeLeg && (signal.decision === TradeAction.BUY || signal.decision === TradeAction.COVER)) {
            const costInNative = signal.sharesToTrade * currentPrice;
            const costInKrw = stock.currency === Currency.USD ? costInNative * exchangeRate : costInNative;
    
            if (portfolio.cash < costInKrw) {
                const shortfall = costInKrw - portfolio.cash;
                logActivity(signal.decision, stock, signal.sharesToTrade, currentPrice, `자금 부족. 은행에서 ${Math.ceil(shortfall).toLocaleString()}원 인출 시도.`);
                const result = await virtualBankService.withdraw(Math.ceil(shortfall));
    
                if (result.success && result.transaction) {
                    setBankBalance(result.newBalance);
                    setBankTransactions(prev => [result.transaction!, ...prev]);
                    setPortfolio(p => ({ ...p, cash: p.cash + result.transaction!.amount }));
                } else {
                    logActivity(signal.decision, stock, signal.sharesToTrade, currentPrice, `주문 실패: 은행 인출 실패.`);
                    return;
                }
            }
        }
    
        logActivity(signal.decision, stock, signal.sharesToTrade, currentPrice, `주문 전송: ${signal.reason}`, signal.confidence);
    
        const confirmation = await executeLiveTrade({
            symbol: stock.symbol,
            action: signal.decision,
            shares: signal.sharesToTrade,
            price: currentPrice,
        });
    
        if (confirmation.status === 'SUCCESS') {
            const { shares, filledPrice, action, symbol } = confirmation;
            
            setPortfolio(prevPortfolio => {
                const newPortfolio = JSON.parse(JSON.stringify(prevPortfolio)); // Deep copy for safety
                const stockInfo = STOCKS[symbol];
                const costInNative = shares * filledPrice;
                const costInKrw = stockInfo.currency === Currency.USD ? costInNative * exchangeRate : costInNative;
                const currentHolding = newPortfolio.holdings[symbol];

                switch (action) {
                    case TradeAction.BUY:
                    case TradeAction.COVER:
                        const positionType = action === TradeAction.BUY ? PositionType.LONG : PositionType.SHORT;
                        if (currentHolding && currentHolding.positionType === positionType) {
                            if (positionType === PositionType.LONG) {
                                const newTotalShares = currentHolding.shares + shares;
                                const newAvgPrice = ((currentHolding.avgPrice * currentHolding.shares) + costInNative) / newTotalShares;
                                currentHolding.shares = newTotalShares;
                                currentHolding.avgPrice = newAvgPrice;
                            } else { // Covering a short
                                currentHolding.shares -= shares;
                            }
                        } else if (positionType === PositionType.LONG) {
                            newPortfolio.holdings[symbol] = { shares, avgPrice: filledPrice, positionType: PositionType.LONG };
                        }
                        if (currentHolding?.shares <= 0) delete newPortfolio.holdings[symbol];
                        newPortfolio.cash -= costInKrw;
                        break;
                    
                    case TradeAction.SELL:
                    case TradeAction.SHORT:
                        const sellPositionType = action === TradeAction.SELL ? PositionType.LONG : PositionType.SHORT;
                         if (currentHolding && currentHolding.positionType === sellPositionType) {
                            if (sellPositionType === PositionType.SHORT) {
                                const newTotalShares = currentHolding.shares + shares;
                                const newAvgPrice = ((currentHolding.avgPrice * currentHolding.shares) + costInNative) / newTotalShares;
                                currentHolding.shares = newTotalShares;
                                currentHolding.avgPrice = newAvgPrice;
                            } else { // Selling a long
                                currentHolding.shares -= shares;
                            }
                        } else if (sellPositionType === PositionType.SHORT) {
                             newPortfolio.holdings[symbol] = { shares, avgPrice: filledPrice, positionType: PositionType.SHORT };
                        }
                        if (currentHolding?.shares <= 0) delete newPortfolio.holdings[symbol];
                        newPortfolio.cash += costInKrw;
                        break;
                }
                
                return newPortfolio;
            });

            logActivity(action, stock, shares, filledPrice, `주문 체결`, signal.confidence);

            if (!isPairTradeLeg) {
                const CASH_THRESHOLD = isAggressiveMode ? 15_000_000 : 10_000_000;
                const CASH_BASELINE = isAggressiveMode ? 7_500_000 : 5_000_000;
                const currentCash = portfolio.cash + (action === TradeAction.SELL || action === TradeAction.SHORT ? (shares * filledPrice * (stock.currency === Currency.USD ? exchangeRate : 1)) : 0);
    
                if (currentCash > CASH_THRESHOLD) {
                    const excessCash = currentCash - CASH_BASELINE;
                    virtualBankService.deposit(excessCash).then(depositResult => {
                        if (depositResult.success && depositResult.transaction) {
                            setBankBalance(depositResult.newBalance);
                            setBankTransactions(prev => [depositResult.transaction!, ...prev]);
                            setPortfolio(p => ({...p, cash: p.cash - excessCash}));
                        }
                    });
                }
            }

        } else {
            logActivity(signal.decision, stock, signal.sharesToTrade, currentPrice, `주문 실패: ${confirmation.reason}`);
        }
    }, [currentPrices, exchangeRate, logActivity, portfolio.cash, isAggressiveMode]);

    const processPairsTradeExecution = useCallback(async (signal: PairsTradingSignal) => {
        const { action, longStock: longSymbol, shortStock: shortSymbol } = signal;
        const pairId = `${longSymbol}-${shortSymbol}`;

        await sendTradeNotification(signal, HedgeFundStrategy.PAIRS_TRADING);

        if (action === TradeAction.ENTER_PAIR_TRADE) {
            if (portfolio.pairTrades[pairId]) {
                setPairsSignal("Pairs Arb: Position already open.");
                return;
            }

            const longStock = STOCKS[longSymbol];
            const shortStock = STOCKS[shortSymbol];
            const longPrice = currentPrices[longSymbol];
            const shortPrice = currentPrices[shortSymbol];
            
            const longValueKrw = PAIRS_TRADE_VALUE_KRW;
            const shortValueKrw = PAIRS_TRADE_VALUE_KRW;

            const longShares = Math.floor(longValueKrw / (longPrice * (longStock.currency === Currency.USD ? exchangeRate : 1)));
            const shortShares = Math.floor(shortValueKrw / (shortPrice * (shortStock.currency === Currency.USD ? exchangeRate : 1)));

            if (longShares < 10 || shortShares < 10) {
                 setPairsSignal("Pairs Arb: Trade size too small.");
                 return;
            }

            logActivity(action, longStock, longShares, longPrice, `페어 트레이드 진입 (Long)`);
            logActivity(action, shortStock, shortShares, shortPrice, `페어 트레이드 진입 (Short)`);

            const longTrade = executeLiveTrade({ symbol: longSymbol, action: TradeAction.BUY, shares: longShares, price: longPrice });
            const shortTrade = executeLiveTrade({ symbol: shortSymbol, action: TradeAction.SHORT, shares: shortShares, price: shortPrice });
            
            const [longConfirm, shortConfirm] = await Promise.all([longTrade, shortTrade]);

            if (longConfirm.status === 'SUCCESS' && shortConfirm.status === 'SUCCESS') {
                 setPortfolio(p => {
                    const newPortfolio = JSON.parse(JSON.stringify(p));
                    
                    const newPair: PairTrade = {
                        id: pairId,
                        longStock: longSymbol, shortStock: shortSymbol, shares: longConfirm.shares,
                        entryPriceLong: longConfirm.filledPrice, entryPriceShort: shortConfirm.filledPrice,
                        entrySpread: longConfirm.filledPrice / shortConfirm.filledPrice, entryTime: new Date().toISOString()
                    };
                    newPortfolio.pairTrades[pairId] = newPair;

                    newPortfolio.holdings[longSymbol] = { shares: longConfirm.shares, avgPrice: longConfirm.filledPrice, positionType: PositionType.LONG, pairSymbol: shortSymbol };
                    newPortfolio.holdings[shortSymbol] = { shares: shortConfirm.shares, avgPrice: shortConfirm.filledPrice, positionType: PositionType.SHORT, pairSymbol: longSymbol };

                    const longCostKrw = longConfirm.shares * longConfirm.filledPrice * (longStock.currency === Currency.USD ? exchangeRate : 1);
                    const shortProceedsKrw = shortConfirm.shares * shortConfirm.filledPrice * (shortStock.currency === Currency.USD ? exchangeRate : 1);
                    newPortfolio.cash = newPortfolio.cash - longCostKrw + shortProceedsKrw;

                    return newPortfolio;
                 });
                 logActivity(TradeAction.BUY, longStock, longConfirm.shares, longConfirm.filledPrice, `페어 체결 (Long)`);
                 logActivity(TradeAction.SHORT, shortStock, shortConfirm.shares, shortConfirm.filledPrice, `페어 체결 (Short)`);
            } else {
                // TODO: Handle partial execution (e.g., unwind successful leg)
                logActivity(action, longStock, 0, 0, `페어 트레이드 실패: ${longConfirm.reason || shortConfirm.reason}`);
            }

        } else if (action === TradeAction.EXIT_PAIR_TRADE) {
            const openPair = portfolio.pairTrades[pairId] || portfolio.pairTrades[`${shortSymbol}-${longSymbol}`];
            if (!openPair) {
                setPairsSignal("Pairs Arb: No position to exit.");
                return;
            }

            const longHolding = portfolio.holdings[openPair.longStock];
            const shortHolding = portfolio.holdings[openPair.shortStock];

            if (!longHolding || !shortHolding) return;

            const longStock = STOCKS[openPair.longStock];
            const shortStock = STOCKS[openPair.shortStock];
            
            logActivity(action, longStock, longHolding.shares, currentPrices[openPair.longStock], `페어 트레이드 청산 (Sell)`);
            logActivity(action, shortStock, shortHolding.shares, currentPrices[openPair.shortStock], `페어 트레이드 청산 (Cover)`);
            
            const sellTrade = executeLiveTrade({ symbol: openPair.longStock, action: TradeAction.SELL, shares: longHolding.shares, price: currentPrices[openPair.longStock] });
            const coverTrade = executeLiveTrade({ symbol: openPair.shortStock, action: TradeAction.COVER, shares: shortHolding.shares, price: currentPrices[openPair.shortStock] });

            const [sellConfirm, coverConfirm] = await Promise.all([sellTrade, coverTrade]);

            if (sellConfirm.status === 'SUCCESS' && coverConfirm.status === 'SUCCESS') {
                setPortfolio(p => {
                    const newPortfolio = JSON.parse(JSON.stringify(p));
                    delete newPortfolio.pairTrades[openPair.id];
                    delete newPortfolio.holdings[openPair.longStock];
                    delete newPortfolio.holdings[openPair.shortStock];

                    const sellProceedsKrw = sellConfirm.shares * sellConfirm.filledPrice * (longStock.currency === Currency.USD ? exchangeRate : 1);
                    const coverCostKrw = coverConfirm.shares * coverConfirm.filledPrice * (shortStock.currency === Currency.USD ? exchangeRate : 1);
                    newPortfolio.cash = newPortfolio.cash + sellProceedsKrw - coverCostKrw;

                    return newPortfolio;
                });
                logActivity(TradeAction.SELL, longStock, sellConfirm.shares, sellConfirm.filledPrice, `페어 청산 체결 (Sell)`);
                logActivity(TradeAction.COVER, shortStock, coverConfirm.shares, coverConfirm.filledPrice, `페어 청산 체결 (Cover)`);
            }
        }
    }, [portfolio.pairTrades, portfolio.holdings, currentPrices, exchangeRate, logActivity]);


    const handleRealtimeTick = useCallback((tick: LiveTick) => {
        if (!isEngineRunning) return;

        setCurrentPrices(prev => ({ ...prev, [tick.symbol]: tick.price }));
        lastTickRef.current[tick.symbol] = tick;
        
        const history = priceHistoryRef.current[tick.symbol];
        if (history) {
            history.push({ time: new Date(tick.timestamp).toLocaleTimeString([], { hour12: false }), price: tick.price });
            if(history.length > 500) history.shift();
        }
    }, [isEngineRunning]);
    
    useEffect(() => {
        if (isEngineRunning) {
            marketDataService.subscribe(handleRealtimeTick);
        } else {
            marketDataService.unsubscribe();
        }
        return () => marketDataService.unsubscribe();
    }, [isEngineRunning, handleRealtimeTick]);
    
    useEffect(() => {
        if (isEngineRunning) {
            const mainTradingLoop = setInterval(async () => {
                // 1. Update market-wide data
                await setExchangeRate(await getExchangeRate());

                setMarketStatuses({
                    KOREA: isMarketOpen(StockSymbol.SAMSUNG) ? 'OPEN' : 'CLOSED',
                    USA: isMarketOpen(StockSymbol.NVIDIA) ? 'OPEN' : 'CLOSED',
                });
                
                setFundamentalData(prev => {
                    const newFundamentals = {...prev};
                    for (const symbol in newFundamentals) {
                        newFundamentals[symbol as StockSymbol] = getUpdatedFundamentalData(newFundamentals[symbol as StockSymbol]);
                    }
                    return newFundamentals;
                });

                const currentMarketRegime = detectMarketRegime(priceHistoryRef.current);
                setMarketRegime(currentMarketRegime);
                
                // 2. CIO makes strategic decision
                const holdingsValue = Object.entries(portfolio.holdings).reduce((acc, [symbol, holding]) => {
                    if (!holding) return acc;
                    const stockInfo = STOCKS[symbol as StockSymbol];
                    const price = currentPrices[symbol as StockSymbol] || 0;
                    const valueInNative = holding.shares * price * (holding.positionType === PositionType.SHORT ? -1 : 1);
                    return acc + (stockInfo.currency === Currency.USD ? valueInNative * exchangeRate : valueInNative);
                }, 0);

                const totalValue = portfolio.cash + holdingsValue;
                const strategicDecision = await getStrategicAllocation(currentMarketRegime, totalValue, isAggressiveMode, isLowLatencyMode);
                
                setActiveStrategy(strategicDecision.strategy);
                setStrategyReason(strategicDecision.reason);
                
                const currentActiveStrategy = strategicDecision.strategy;

                // 3. Execute strategy across all stocks
                if (currentActiveStrategy === HedgeFundStrategy.PAIRS_TRADING) {
                     if (isMarketOpen(StockSymbol.MICRON)) { // Check if the pair market is open
                        const history1 = priceHistoryRef.current[StockSymbol.MICRON];
                        const history2 = priceHistoryRef.current[StockSymbol.HYNIX];
                        const signal = getPairsTradingSignal(history1, history2);
                        if (signal) {
                            setPairsSignal(signal.reason);
                            await processPairsTradeExecution(signal);
                        } else {
                            setPairsSignal("Pairs Arb: Monitoring spread, no signal.");
                        }
                    } else {
                         setPairsSignal("Pairs Arb: Market closed.");
                    }
                } else if (currentActiveStrategy !== HedgeFundStrategy.RISK_OFF) {
                    setPairsSignal(null);
                    const stockSymbols = Object.keys(STOCKS) as StockSymbol[];
                    for (const symbol of stockSymbols) {
                        if (!isMarketOpen(symbol)) continue; // *** CRITICAL: ONLY TRADE OPEN MARKETS ***
                        
                        const stock = STOCKS[symbol];
                        const history = priceHistoryRef.current[symbol];
                        if (!history || history.length < 20) continue;

                        const trend = calculateTrend(history);
                        const fundamentals = fundamentalData[symbol];
                        
                        setCurrentAnalysis({ stock, factors: alphaFactors[symbol], trend, fundamentals, activeStrategy: currentActiveStrategy });
                        setCurrentAnalystSignal(null);
                        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UI update

                        let decisionSignal: AITradeSignal | null = null;

                        if (currentActiveStrategy === HedgeFundStrategy.JOCODING_MA_CROSS) {
                            const technicalSignal = getMovingAverageCrossSignal(history);
                            const shortMA = calculateSMA(history, SHORT_MA_PERIOD);
                            const longMA = calculateSMA(history, LONG_MA_PERIOD);
                            setCurrentAnalysis({ stock, factors: alphaFactors[symbol], trend, fundamentals, activeStrategy: currentActiveStrategy, shortMA, longMA });
                            if (technicalSignal) {
                                decisionSignal = {
                                    decision: technicalSignal.action, reason: technicalSignal.reason,
                                    sharesToTrade: isAggressiveMode ? 50 : 20, confidence: 0.9,
                                };
                            }
                        } else if (currentActiveStrategy === HedgeFundStrategy.DEEP_HEDGING) {
                            const features = extractFeaturesFromData(history);
                            decisionSignal = await getMlInferenceSignal(stock, features, isAggressiveMode, isLowLatencyMode);
                            setMlSignals(prev => ({ ...prev, [symbol]: decisionSignal }));
                        } else if (currentActiveStrategy === HedgeFundStrategy.ALPHA_MOMENTUM || currentActiveStrategy === HedgeFundStrategy.MEAN_REVERSION) {
                            const factors = getUpdatedAlphaFactors(alphaFactors[symbol], history, currentActiveStrategy);
                            setAlphaFactors(prev => ({...prev, [symbol]: factors}));
                            setCurrentAnalysis(prev => ({ ...prev!, factors })); // Update analysis with new factors
                            decisionSignal = await getAiTradeSignal(stock, currentActiveStrategy, factors, trend, fundamentals, isAggressiveMode, isLowLatencyMode);
                            setCurrentAnalystSignal(decisionSignal);
                        }
                        
                        if (decisionSignal) {
                            if (decisionSignal.decision === TradeAction.HOLD) {
                                logActivity(TradeAction.HOLD, stock, 0, currentPrices[symbol], decisionSignal.reason, decisionSignal.confidence);
                            } else {
                                await processTradeExecution(stock, decisionSignal, currentActiveStrategy);
                            }
                        }
                        await new Promise(resolve => setTimeout(resolve, 300)); // Pace the analysis
                    }
                }

                // 4. Aggregate new candles for charts
                setChartData(prevChartData => {
                    const newChartData = { ...prevChartData };
                    for (const symbolStr in STOCKS) {
                        const symbol = symbolStr as StockSymbol;
                        const lastTick = lastTickRef.current[symbol];
                        if (lastTick) {
                            const timeKey = new Date(Math.floor(Date.now() / AGGREGATION_INTERVAL) * AGGREGATION_INTERVAL).toLocaleTimeString([], { hour12: false });
                             if (!candleAggregatorRef.current[symbol]) {
                                candleAggregatorRef.current[symbol] = { open: lastTick.price, high: lastTick.price, low: lastTick.price, close: lastTick.price, time: timeKey };
                             } else {
                                const candle = candleAggregatorRef.current[symbol]!;
                                candle.high = Math.max(candle.high, lastTick.price);
                                candle.low = Math.min(candle.low, lastTick.price);
                                candle.close = lastTick.price;

                                if (candle.time !== timeKey) {
                                    const dataSeries = newChartData[symbol];
                                    if(dataSeries.length > 0 && dataSeries[dataSeries.length - 1].time !== candle.time) {
                                        dataSeries.push(candle);
                                        if(dataSeries.length > 100) dataSeries.shift();
                                    } else if (dataSeries.length === 0) {
                                        dataSeries.push(candle);
                                    }
                                    candleAggregatorRef.current[symbol] = { open: lastTick.price, high: lastTick.price, low: lastTick.price, close: lastTick.price, time: timeKey };
                                }
                             }
                        }
                    }
                    return newChartData;
                });

            }, TRADING_LOOP_INTERVAL);
            return () => clearInterval(mainTradingLoop);
        }
    }, [isEngineRunning, portfolio, currentPrices, isAggressiveMode, isLowLatencyMode, exchangeRate, processPairsTradeExecution, alphaFactors, fundamentalData, logActivity, processTradeExecution]);
    
     useEffect(() => {
        const stockSymbols = Object.keys(STOCKS) as StockSymbol[];
        const firstSymbol = stockSymbols[0];
        if (!chartData[firstSymbol] || chartData[firstSymbol].length === 0) return;

        const basePrices = stockSymbols.reduce((acc, symbol) => {
            acc[symbol] = chartData[symbol][0]?.close || 1;
            return acc;
        }, {} as { [key in StockSymbol]: number });

        const combinedData: NormalizedChartDataPoint[] = chartData[firstSymbol].map((_, index) => {
            const dataPoint: NormalizedChartDataPoint = {
                time: chartData[firstSymbol][index]?.time,
            };
            stockSymbols.forEach(symbol => {
                const currentPoint = chartData[symbol][index];
                const basePrice = basePrices[symbol];
                if (currentPoint && basePrice > 0) {
                    dataPoint[symbol] = (currentPoint.close / basePrice) * 100;
                    dataPoint[`${symbol}_price`] = currentPoint.close;
                }
            });
            return dataPoint;
        });

        setNormalizedChartData(combinedData);
    }, [chartData]);
    
    const calculateTrend = (history: ChartDataPoint[]): Trend => {
        if (history.length < 20) return 'NEUTRAL';
        const ma5 = calculateSMA(history.slice(-20), 5);
        const ma20 = calculateSMA(history.slice(-20), 20);
        if (ma5 && ma20) {
            if (ma5 > ma20 * 1.001) return 'UPTREND';
            if (ma5 < ma20 * 0.999) return 'DOWNTREND';
        }
        return 'NEUTRAL';
    };
    
    const toggleEngine = () => setIsEngineRunning(!isEngineRunning);
    const toggleAggressiveMode = () => setIsAggressiveMode(!isAggressiveMode);
    const toggleLowLatencyMode = () => setIsLowLatencyMode(!isLowLatencyMode);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <ControlPanel 
                        isEngineRunning={isEngineRunning}
                        onToggleEngine={toggleEngine}
                        isAggressiveMode={isAggressiveMode}
                        onToggleAggressiveMode={toggleAggressiveMode}
                        isLowLatencyMode={isLowLatencyMode}
                        onToggleLowLatencyMode={toggleLowLatencyMode}
                        liveTime={liveTime}
                        marketRegime={marketRegime}
                        activeStrategy={activeStrategy}
                        strategyReason={strategyReason}
                        marketStatuses={marketStatuses}
                    />
                    <CombinedStockChart data={normalizedChartData} activities={activityLog} />
                </div>
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <PortfolioSummary 
                        portfolio={portfolio} 
                        stocks={STOCKS}
                        currentPrices={currentPrices}
                        exchangeRate={exchangeRate}
                    />
                    <VirtualBank balance={bankBalance} transactions={bankTransactions} />
                     <AiAnalysisFactors 
                      analysis={currentAnalysis} 
                      activeStrategy={activeStrategy}
                      pairsSignal={pairsSignal}
                      mlSignal={currentAnalysis ? mlSignals[currentAnalysis.stock.symbol] || null : null}
                      analystSignal={currentAnalystSignal}
                    />
                    <ActivityLog activities={activityLog} isLoading={false} />
                </div>
            </div>
            <IndividualCharts allChartData={chartData} activities={activityLog} />
        </div>
    );
};

export default Dashboard;