import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StockSymbol, Portfolio, Activity, TradeAction, NormalizedChartDataPoint, Currency, AnalysisFocus, AlphaFactors, Trend, HedgeFundStrategy, MarketRegime, Stock, CandlestickDataPoint, ChartDataPoint, LiveTick, BankTransaction, PositionType, FundamentalData, AITradeSignal, PairTrade, PairsTradingSignal } from '../../types';
import { STOCKS } from '../../constants';
import { getStrategicAllocation, getAiTradeSignal, getMlInferenceSignal } from '../../services/geminiService';
import { getPairsTradingSignal } from '../../services/pairsTradingService';
import { getMovingAverageCrossSignal, SHORT_MA_PERIOD, LONG_MA_PERIOD } from '../../services/technicalAnalysisService';
import { marketDataService, isMarketOpen } from '../../services/marketDataService';
import { extractFeaturesFromData } from '../../services/mlService';
import { executeLiveTrade } from '../../services/tradingExecutionService';
import { virtualBankService } from '../../services/virtualBankService';
import ControlPanel from './ControlPanel';
import CombinedStockChart from './CombinedStockChart';
import PortfolioSummary from './PortfolioSummary';
import ActivityLog from './ActivityLog';
import AiAnalysisFactors from './AiAnalysisFactors';
import IndividualCharts from './IndividualCharts';
import VirtualBank from './VirtualBank';
import { calculateSMA } from '../../services/movingAverage';

const AGGREGATION_INTERVAL = 5000;
const PAIRS_TRADE_VALUE_KRW = 2_000_000;
const TRADING_LOOP_INTERVAL = 5000;

type MarketStatus = 'OPEN' | 'CLOSED';

const Dashboard: React.FC = () => {
    const [isEngineRunning, setIsEngineRunning] = useState<boolean>(false);
    const [isAggressiveMode, setIsAggressiveMode] = useState<boolean>(false);
    const [isLowLatencyMode, setIsLowLatencyMode] = useState<boolean>(false);
    
    const priceHistoryRef = useRef<{ [key in StockSymbol]: ChartDataPoint[] }>({} as { [key in StockSymbol]: ChartDataPoint[] });
    const candleAggregatorRef = useRef<{ [key in StockSymbol]?: {open: number, high: number, low: number, close: number, time: string} }>({});

    const [chartData, setChartData] = useState<{ [key in StockSymbol]: CandlestickDataPoint[] }>({} as any);
    const [normalizedChartData, setNormalizedChartData] = useState<NormalizedChartDataPoint[]>([]);
    const [currentPrices, setCurrentPrices] = useState<{ [key in StockSymbol]: number }>({} as any);

    const [portfolio, setPortfolio] = useState<Portfolio>({
        cash: 0,
        holdings: {},
        pairTrades: {},
    });
    const [bankBalance, setBankBalance] = useState<number>(0);
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);

    const [activityLog, setActivityLog] = useState<Activity[]>([]);
    const [exchangeRate, setExchangeRate] = useState<number>(1380);
    const [alphaFactors, setAlphaFactors] = useState<{ [key in StockSymbol]: AlphaFactors }>({} as any);
    const [fundamentalData, setFundamentalData] = useState<{ [key in StockSymbol]: FundamentalData }>({} as any);
    
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
        const initialize = async () => {
            try {
                const initialChartData = await marketDataService.getInitialData();
                setChartData(initialChartData);

                for (const symbol in initialChartData) {
                    const s = symbol as StockSymbol;
                    priceHistoryRef.current[s] = initialChartData[s].map(d => ({ time: d.time, price: d.close }));
                }
                
                const bankData = await virtualBankService.getBankData();
                setBankBalance(bankData.balance);
                setBankTransactions(bankData.transactions);
                
                const initialPortfolio = await (await fetch('/api/portfolio')).json();
                setPortfolio(initialPortfolio);
            } catch (error) {
                console.error("Error during initialization:", error);
            }
        };
        initialize();
        
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
    
        const currentPrice = currentPrices[stock.symbol];
    
        // Log the intent to trade. The backend will handle funding.
        logActivity(signal.decision, stock, signal.sharesToTrade, currentPrice, `주문 전송: ${signal.reason}`, signal.confidence);
    
        // The backend now handles all logic regarding cash, banking, and portfolio updates.
        const confirmation = await executeLiveTrade({
            symbol: stock.symbol,
            action: signal.decision,
            shares: signal.sharesToTrade,
            price: currentPrice,
        });
    
        if (confirmation.status === 'SUCCESS') {
            const { action, symbol, shares, filledPrice } = confirmation;
            logActivity(action, STOCKS[symbol], shares, filledPrice, `주문 체결`, signal.confidence);

            // Refetch both portfolio and bank data to get the latest state from the server
            const [updatedPortfolio, updatedBankData] = await Promise.all([
                fetch('/api/portfolio').then(res => res.json()),
                virtualBankService.getBankData()
            ]);

            setPortfolio(updatedPortfolio);
            setBankBalance(updatedBankData.balance);
            setBankTransactions(updatedBankData.transactions);

            // This logic for depositing excess cash is fine to keep on the client as it's a "housekeeping" task
            const CASH_THRESHOLD = isAggressiveMode ? 15_000_000 : 10_000_000;
            const CASH_BASELINE = isAggressiveMode ? 7_500_000 : 5_000_000;
            
            if (!isPairTradeLeg && updatedPortfolio.cash > CASH_THRESHOLD) {
                const excessCash = updatedPortfolio.cash - CASH_BASELINE;
                logActivity(TradeAction.HOLD, stock, 0, 0, `초과 현금 ${Math.floor(excessCash).toLocaleString()}원 은행에 자동 입금.`);
                virtualBankService.deposit(excessCash).then(depositResult => {
                    if (depositResult.success && depositResult.transaction) {
                        setBankBalance(depositResult.newBalance);
                        setBankTransactions(prev => [depositResult.transaction!, ...prev]);
                        setPortfolio(p => ({...p, cash: p.cash - excessCash}));
                    }
                });
            }

        } else {
            logActivity(signal.decision, stock, signal.sharesToTrade, currentPrice, `주문 실패: ${confirmation.reason}`);
        }
    }, [currentPrices, logActivity, isAggressiveMode]);

    const processPairsTradeExecution = useCallback(async (signal: PairsTradingSignal) => {
        // This logic remains complex and would require dedicated backend endpoints
        // For now, we simulate the logging and assume backend would handle execution
         logActivity(signal.action, STOCKS[signal.longStock], 0, 0, signal.reason);
    }, [logActivity]);


    const handleRealtimeTick = useCallback((tick: LiveTick) => {
        if (!isEngineRunning) return;

        setCurrentPrices(prev => ({ ...prev, [tick.symbol]: tick.price }));
        
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
              try {
                const serverState = await(await fetch('/api/server-state')).json();
                
                setExchangeRate(serverState.exchangeRate);
                setMarketStatuses(serverState.marketStatuses);
                setFundamentalData(serverState.fundamentalData);
                setAlphaFactors(serverState.alphaFactors);
                setMarketRegime(serverState.marketRegime);

                const totalValue = portfolio.cash + Object.entries(portfolio.holdings).reduce((acc, [symbol, holding]) => {
                    if (!holding) return acc;
                    const stockInfo = STOCKS[symbol as StockSymbol];
                    const price = currentPrices[symbol as StockSymbol] || 0;
                    const valueInNative = holding.shares * price * (holding.positionType === PositionType.SHORT ? -1 : 1);
                    return acc + (stockInfo.currency === Currency.USD ? valueInNative * exchangeRate : valueInNative);
                }, 0);

                const strategicDecision = await getStrategicAllocation(serverState.marketRegime, totalValue, isAggressiveMode, isLowLatencyMode);
                setActiveStrategy(strategicDecision.strategy);
                setStrategyReason(strategicDecision.reason);
                const currentActiveStrategy = strategicDecision.strategy;

                if (currentActiveStrategy === HedgeFundStrategy.PAIRS_TRADING) {
                     if (isMarketOpen(StockSymbol.MICRON, serverState.marketStatuses)) {
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
                    const stockSymbols = (Object.keys(STOCKS) as StockSymbol[]).sort((a, b) => {
                        const stockA_is_KRW = STOCKS[a].currency === Currency.KRW;
                        const stockB_is_KRW = STOCKS[b].currency === Currency.KRW;
                        if (stockA_is_KRW && !stockB_is_KRW) return -1;
                        if (!stockA_is_KRW && stockB_is_KRW) return 1;
                        return 0;
                    });
                    for (const symbol of stockSymbols) {
                        if (!isMarketOpen(symbol, serverState.marketStatuses)) continue;
                        
                        const stock = STOCKS[symbol];
                        const history = priceHistoryRef.current[symbol];
                        if (!history || history.length < 20) continue;

                        const trend = calculateTrend(history);
                        const fundamentals = serverState.fundamentalData[symbol];
                        
                        setCurrentAnalysis({ stock, factors: serverState.alphaFactors[symbol], trend, fundamentals, activeStrategy: currentActiveStrategy });
                        setCurrentAnalystSignal(null);
                        await new Promise(resolve => setTimeout(resolve, 100));

                        let decisionSignal: AITradeSignal | null = null;
                        if (currentActiveStrategy === HedgeFundStrategy.JOCODING_MA_CROSS) {
                            const technicalSignal = getMovingAverageCrossSignal(history);
                            setCurrentAnalysis({ stock, factors: serverState.alphaFactors[symbol], trend, fundamentals, activeStrategy: currentActiveStrategy, shortMA: calculateSMA(history, SHORT_MA_PERIOD), longMA: calculateSMA(history, LONG_MA_PERIOD) });
                            if (technicalSignal) {
                                decisionSignal = { decision: technicalSignal.action, reason: technicalSignal.reason, sharesToTrade: isAggressiveMode ? 50 : 20, confidence: 0.9 };
                            }
                        } else if (currentActiveStrategy === HedgeFundStrategy.DEEP_HEDGING) {
                            decisionSignal = await getMlInferenceSignal(stock, extractFeaturesFromData(history), isAggressiveMode, isLowLatencyMode);
                            setMlSignals(prev => ({ ...prev, [symbol]: decisionSignal! }));
                        } else {
                            decisionSignal = await getAiTradeSignal(stock, currentActiveStrategy, serverState.alphaFactors[symbol], trend, fundamentals, isAggressiveMode, isLowLatencyMode);
                            setCurrentAnalystSignal(decisionSignal);
                        }
                        
                        if (decisionSignal) {
                            if (decisionSignal.decision === TradeAction.HOLD) {
                                logActivity(TradeAction.HOLD, stock, 0, currentPrices[symbol], decisionSignal.reason, decisionSignal.confidence);
                            } else {
                                await processTradeExecution(stock, decisionSignal, currentActiveStrategy);
                            }
                        }
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }

                // Aggregate candles (visual only)
                const latestTicks = await(await fetch('/api/latest-ticks')).json();
                setChartData(prevChartData => {
                    const newChartData = { ...prevChartData };
                    for (const symbolStr in STOCKS) {
                        const symbol = symbolStr as StockSymbol;
                        const lastTick = latestTicks[symbol];
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
                                    if(dataSeries && dataSeries.length > 0 && dataSeries[dataSeries.length - 1].time !== candle.time) {
                                        dataSeries.push(candle);
                                        if(dataSeries.length > 100) dataSeries.shift();
                                    } else if (dataSeries && dataSeries.length === 0) {
                                        dataSeries.push(candle);
                                    }
                                    candleAggregatorRef.current[symbol] = { open: lastTick.price, high: lastTick.price, low: lastTick.price, close: lastTick.price, time: timeKey };
                                }
                             }
                        }
                    }
                    return newChartData;
                });
              } catch (error) {
                  console.error("Error in main trading loop:", error);
                  logActivity(TradeAction.HOLD, STOCKS[StockSymbol.SAMSUNG], 0, 0, `엔진 루프 오류: ${(error as Error).message}`);
              }

            }, TRADING_LOOP_INTERVAL);
            return () => clearInterval(mainTradingLoop);
        }
    }, [isEngineRunning, portfolio, currentPrices, isAggressiveMode, isLowLatencyMode, exchangeRate, processPairsTradeExecution, logActivity, processTradeExecution]);
    
     useEffect(() => {
        if (!chartData || Object.keys(chartData).length === 0) return;

        const stockSymbols = Object.keys(STOCKS) as StockSymbol[];
        const firstSymbol = stockSymbols[0];
        if (!chartData[firstSymbol] || chartData[firstSymbol].length === 0) return;

        const basePrices = stockSymbols.reduce((acc, symbol) => {
            acc[symbol] = chartData[symbol][0]?.close || 1;
            return acc;
        }, {} as { [key in StockSymbol]: number });

        const combinedData: NormalizedChartDataPoint[] = chartData[firstSymbol].map((_, index) => {
            const dataPoint: NormalizedChartDataPoint = { time: chartData[firstSymbol][index]?.time };
            stockSymbols.forEach(symbol => {
                const currentPoint = chartData[symbol]?.[index];
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
                        isEngineRunning={isEngineRunning} onToggleEngine={toggleEngine}
                        isAggressiveMode={isAggressiveMode} onToggleAggressiveMode={toggleAggressiveMode}
                        isLowLatencyMode={isLowLatencyMode} onToggleLowLatencyMode={toggleLowLatencyMode}
                        liveTime={liveTime} marketRegime={marketRegime} activeStrategy={activeStrategy}
                        strategyReason={strategyReason} marketStatuses={marketStatuses}
                    />
                    <CombinedStockChart data={normalizedChartData} activities={activityLog} />
                </div>
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <PortfolioSummary portfolio={portfolio} stocks={STOCKS} currentPrices={currentPrices} exchangeRate={exchangeRate} />
                    <VirtualBank balance={bankBalance} transactions={bankTransactions} />
                     <AiAnalysisFactors 
                      analysis={currentAnalysis} activeStrategy={activeStrategy}
                      pairsSignal={pairsSignal}
                      mlSignal={currentAnalysis ? mlSignals[currentAnalysis.stock.symbol] || null : null}
                      analystSignal={currentAnalystSignal}
                    />
                    <ActivityLog activities={activityLog} isLoading={!chartData || Object.keys(chartData).length === 0} />
                </div>
            </div>
            <IndividualCharts allChartData={chartData} activities={activityLog} />
        </div>
    );
};

export default Dashboard;