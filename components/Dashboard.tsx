
import React, { useState, useEffect, useCallback } from 'react';
import { StockSymbol, Portfolio, Activity, TradeAction, NormalizedChartDataPoint, Currency, AnalysisFocus, AlphaFactors, Trend, HedgeFundStrategy, MarketRegime, PairTrade, PositionType, Stock, CandlestickDataPoint, ChartDataPoint } from '../types';
import { STOCKS } from '../constants';
import { getStrategicAllocation, getAiTradeSignal, AITradeSignal } from '../services/geminiService';
import { getExchangeRate } from '../services/exchangeRateService';
import { initializeAlphaFactors, getUpdatedAlphaFactors } from '../services/alphaFactorService';
import { calculateSMA } from '../services/movingAverage';
import { getPairsTradingSignal, PairsTradingSignal } from '../services/pairsTradingService';
import { detectMarketRegime } from '../services/marketRegimeService';
import { historicalData } from '../services/historicalDataService';
import ControlPanel from './ControlPanel';
import CombinedStockChart from './CombinedStockChart';
import PortfolioSummary from './PortfolioSummary';
import ActivityLog from './ActivityLog';
import AiAnalysisFactors from './AiAnalysisFactors';
import IndividualCharts from './IndividualCharts';

const Dashboard: React.FC = () => {
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentDateIndex, setCurrentDateIndex] = useState<number>(50);

    const [chartData, setChartData] = useState({} as { [key in StockSymbol]: CandlestickDataPoint[] });
    const [normalizedChartData, setNormalizedChartData] = useState<NormalizedChartDataPoint[]>([]);

    const [portfolio, setPortfolio] = useState<Portfolio>({
        cash: 20000000,
        holdings: {},
        pairTrades: {},
    });
    const [activityLog, setActivityLog] = useState<Activity[]>([]);
    const [exchangeRate, setExchangeRate] = useState<number>(1380);
    const [alphaFactors, setAlphaFactors] = useState<{ [key in StockSymbol]: AlphaFactors }>(initializeAlphaFactors());
    
    const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisFocus | null>(null);
    const [currentDate, setCurrentDate] = useState<string>('');
    const [marketRegime, setMarketRegime] = useState<MarketRegime>(MarketRegime.NEUTRAL);
    const [activeStrategy, setActiveStrategy] = useState<HedgeFundStrategy>(HedgeFundStrategy.RISK_OFF);
    const [strategyReason, setStrategyReason] = useState("");
    const [pairsSignal, setPairsSignal] = useState<string | null>(null);
    
    useEffect(() => {
        // Initialize chart data with the first 50 historical data points
        const initialData = {} as { [key in StockSymbol]: CandlestickDataPoint[] };
        for (const symbol in historicalData) {
            initialData[symbol as StockSymbol] = historicalData[symbol as StockSymbol].slice(0, 50);
        }
        setChartData(initialData);
        if (historicalData[StockSymbol.SAMSUNG]?.[49]) {
            setCurrentDate(historicalData[StockSymbol.SAMSUNG][49].time);
        }
    }, []);


    useEffect(() => {
        const stockSymbols = Object.keys(STOCKS) as StockSymbol[];
        if (!chartData[stockSymbols[0]] || chartData[stockSymbols[0]].length === 0) return;

        const basePrices = stockSymbols.reduce((acc, symbol) => {
            acc[symbol] = chartData[symbol][0]?.close || 1;
            return acc;
        }, {} as { [key in StockSymbol]: number });

        const combinedData: NormalizedChartDataPoint[] = chartData[stockSymbols[0]].map((_, index) => {
            const dataPoint: NormalizedChartDataPoint = {
                time: chartData[stockSymbols[0]][index]?.time,
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
    
    const logActivity = (action: TradeAction, stock: Stock, shares: number, price: number, reason: string, time: string) => {
        const newActivity: Activity = {
            id: new Date().toISOString() + Math.random(),
            timestamp: time,
            action, stock, shares, price, reason, time,
        };
        setActivityLog(prev => [newActivity, ...prev.slice(0, 199)]);
    };
    
    const calculateSlippage = (shares: number, price: number): number => {
      const slippagePercent = Math.min(0.005, (shares / 1000) * 0.001);
      return price * slippagePercent;
    };

    const runSimulationStep = useCallback(async () => {
        setIsLoading(true);

        const newIndex = currentDateIndex + 1;
        if (newIndex >= historicalData[StockSymbol.SAMSUNG].length) {
            setIsRunning(false);
            setIsLoading(false);
            return;
        }
        setCurrentDateIndex(newIndex);
        const currentDateStr = historicalData[StockSymbol.SAMSUNG][newIndex].time;
        setCurrentDate(currentDateStr);

        const newChartData = {} as { [key in StockSymbol]: CandlestickDataPoint[] };
        const currentPricesMap = {} as { [key in StockSymbol]: number };
        const historyForAnalysis = {} as { [key in StockSymbol]: ChartDataPoint[] };
        
        for (const symbol in historicalData) {
            const sym = symbol as StockSymbol;
            const historySlice = historicalData[sym].slice(0, newIndex + 1);
            newChartData[sym] = historySlice;
            currentPricesMap[sym] = historySlice[historySlice.length - 1].close;
            historyForAnalysis[sym] = historySlice.map(d => ({ time: d.time, price: d.close }));
        }
        
        setChartData(newChartData);
        
        const currentExchangeRate = await getExchangeRate();
        setExchangeRate(currentExchangeRate);

        const updatedFactors: { [key in StockSymbol]?: AlphaFactors } = {};
        const stockTrends: { [key in StockSymbol]?: Trend } = {};
        
        for (const stock of Object.values(STOCKS)) {
            stockTrends[stock.symbol] = calculateTrend(historyForAnalysis[stock.symbol]);
        }
        
        const currentMarketRegime = detectMarketRegime(historyForAnalysis);
        setMarketRegime(currentMarketRegime);
        
        const holdingsValue = Object.entries(portfolio.holdings).reduce((acc, [symbol, holding]) => {
            const stock = STOCKS[symbol as StockSymbol];
            const price = currentPricesMap[symbol as StockSymbol];
            let valueInNativeCurrency;
            if (holding.positionType === PositionType.SHORT) {
                valueInNativeCurrency = -(holding.shares * price);
            } else {
                valueInNativeCurrency = holding.shares * price;
            }
            const valueInKrw = stock.currency === Currency.USD ? valueInNativeCurrency * currentExchangeRate : valueInNativeCurrency;
            return acc + valueInKrw;
        }, 0);
        const totalValue = portfolio.cash + holdingsValue;

        const strategicDecision = await getStrategicAllocation(currentMarketRegime, totalValue);
        setActiveStrategy(strategicDecision.strategy);
        setStrategyReason(strategicDecision.reason);
        
        for (const stock of Object.values(STOCKS)) {
            updatedFactors[stock.symbol] = getUpdatedAlphaFactors(alphaFactors[stock.symbol], historyForAnalysis[stock.symbol], strategicDecision.strategy);
        }

        setAlphaFactors(prev => ({...prev, ...updatedFactors}));
        
        let tempPortfolio = JSON.parse(JSON.stringify(portfolio));
        
        const activePairsSignal = getPairsTradingSignal(historyForAnalysis[StockSymbol.MICRON], historyForAnalysis[StockSymbol.HYNIX]);
        setPairsSignal(activePairsSignal ? activePairsSignal.reason.split(':')[1].trim() : null);

        if (strategicDecision.strategy === HedgeFundStrategy.PAIRS_TRADING) {
            if (activePairsSignal?.action === 'ENTER_PAIR_TRADE' && !tempPortfolio.pairTrades['MU-HYNIX']) {
                tempPortfolio = executePairTrade(tempPortfolio, activePairsSignal, currentPricesMap, currentExchangeRate, currentDateStr);
            } else if (activePairsSignal?.action === 'EXIT_PAIR_TRADE' && tempPortfolio.pairTrades['MU-HYNIX']) {
                tempPortfolio = exitPairTrade(tempPortfolio, 'MU-HYNIX', currentPricesMap, currentExchangeRate, currentDateStr);
            }
        }
        else if (strategicDecision.strategy === HedgeFundStrategy.ALPHA_MOMENTUM || strategicDecision.strategy === HedgeFundStrategy.MEAN_REVERSION) {
            for (const stock of Object.values(STOCKS)) {
                if (!tempPortfolio.holdings[stock.symbol]?.pairSymbol) {
                    setCurrentAnalysis({ stock, factors: updatedFactors[stock.symbol]!, trend: stockTrends[stock.symbol]! });
                    const analystSignal = await getAiTradeSignal(stock, strategicDecision.strategy, updatedFactors[stock.symbol]!, stockTrends[stock.symbol]!);
                    tempPortfolio = executeDirectionalTrade(tempPortfolio, stock, analystSignal, currentPricesMap, currentExchangeRate, currentDateStr);
                }
            }
        } else if (strategicDecision.strategy === HedgeFundStrategy.RISK_OFF) {
            for (const stock of Object.values(STOCKS)) {
                if (tempPortfolio.holdings[stock.symbol] && !tempPortfolio.holdings[stock.symbol]?.pairSymbol) {
                    tempPortfolio = liquidatePosition(tempPortfolio, stock, currentPricesMap, currentExchangeRate, currentDateStr, "RISK_OFF: 포지션 청산");
                }
            }
            for (const pairId of Object.keys(tempPortfolio.pairTrades)) {
                tempPortfolio = exitPairTrade(tempPortfolio, pairId, currentPricesMap, currentExchangeRate, currentDateStr);
            }
        }
        
        setPortfolio(tempPortfolio);
        setIsLoading(false);

    }, [currentDateIndex, portfolio, alphaFactors]);

    const calculateTrend = (history: ChartDataPoint[]): Trend => {
        if (history.length < 20) return 'NEUTRAL';
        const ma5 = calculateSMA(history, 5);
        const ma20 = calculateSMA(history, 20);
        if (ma5 && ma20) {
            if (ma5 > ma20 * 1.001) return 'UPTREND';
            if (ma5 < ma20 * 0.999) return 'DOWNTREND';
        }
        return 'NEUTRAL';
    };
    
    const executeDirectionalTrade = (p: Portfolio, stock: Stock, signal: AITradeSignal, prices: { [k in StockSymbol]: number }, exRate: number, time: string): Portfolio => {
        const { decision, sharesToTrade, reason } = signal;
        if (decision === TradeAction.HOLD || sharesToTrade === 0) return p;

        const currentPrice = prices[stock.symbol];
        const slippage = calculateSlippage(sharesToTrade, currentPrice);
        const holding = p.holdings[stock.symbol];

        const execute = (action: TradeAction, effectivePrice: number) => {
            const costInNative = sharesToTrade * effectivePrice;
            const costInKrw = stock.currency === Currency.USD ? costInNative * exRate : costInNative;

            if (action === TradeAction.BUY) {
                if (p.cash < costInKrw) { logActivity(action, stock, 0, currentPrice, "자금 부족", time); return p; }
                const newTotalShares = (holding?.shares || 0) + sharesToTrade;
                const newTotalCost = ((holding?.shares || 0) * (holding?.avgPrice || 0)) + costInNative;
                p.holdings[stock.symbol] = { shares: newTotalShares, avgPrice: newTotalCost / newTotalShares, positionType: PositionType.LONG };
                p.cash -= costInKrw;
            } else if (action === TradeAction.SELL) {
                if (!holding || holding.shares < sharesToTrade) { logActivity(action, stock, 0, currentPrice, "수량 부족", time); return p; }
                holding.shares -= sharesToTrade;
                if (holding.shares === 0) delete p.holdings[stock.symbol];
                p.cash += costInKrw;
            } else if (action === TradeAction.SHORT) {
                 if (holding) { logActivity(action, stock, 0, currentPrice, "포지션 보유중", time); return p; }
                 p.holdings[stock.symbol] = { shares: sharesToTrade, avgPrice: effectivePrice, positionType: PositionType.SHORT };
                 p.cash += costInKrw;
            } else if (action === TradeAction.COVER) {
                 if (!holding || holding.positionType !== PositionType.SHORT || holding.shares < sharesToTrade) { logActivity(action, stock, 0, currentPrice, "포지션 없음", time); return p; }
                 if (p.cash < costInKrw) { logActivity(action, stock, 0, currentPrice, "자금 부족", time); return p; }
                 holding.shares -= sharesToTrade;
                 if (holding.shares === 0) delete p.holdings[stock.symbol];
                 p.cash -= costInKrw;
            }
            logActivity(action, stock, sharesToTrade, currentPrice, reason, time);
            return p;
        }

        switch(decision) {
            case TradeAction.BUY: return execute(TradeAction.BUY, currentPrice + slippage);
            case TradeAction.SELL: return execute(TradeAction.SELL, currentPrice - slippage);
            case TradeAction.SHORT: return execute(TradeAction.SHORT, currentPrice - slippage);
            case TradeAction.COVER: return execute(TradeAction.COVER, currentPrice + slippage);
            default: return p;
        }
    };
    
    const liquidatePosition = (p: Portfolio, stock: Stock, prices: { [k in StockSymbol]: number }, exRate: number, time: string, reason: string): Portfolio => {
        const holding = p.holdings[stock.symbol];
        if (!holding) return p;
        
        const currentPrice = prices[stock.symbol];
        const slippage = calculateSlippage(holding.shares, currentPrice);
        const action = holding.positionType === PositionType.LONG ? TradeAction.SELL : TradeAction.COVER;
        const effectivePrice = action === TradeAction.SELL ? currentPrice - slippage : currentPrice + slippage;
        const valueInNative = holding.shares * effectivePrice;
        const valueInKrw = stock.currency === Currency.USD ? valueInNative * exRate : valueInNative;
        
        if (action === TradeAction.COVER && p.cash < valueInKrw) { logActivity(action, stock, 0, currentPrice, "자금 부족", time); return p; }
        
        if (action === TradeAction.SELL) p.cash += valueInKrw;
        else p.cash -= valueInKrw;

        logActivity(action, stock, holding.shares, currentPrice, reason, time);
        delete p.holdings[stock.symbol];
        return p;
    };

    const executePairTrade = (p: Portfolio, signal: PairsTradingSignal, prices: { [k in StockSymbol]: number }, exRate: number, time: string): Portfolio => {
        const { longStock: longSymbol, shortStock: shortSymbol, reason } = signal;
        const longStock = STOCKS[longSymbol];
        const shortStock = STOCKS[shortSymbol];
        
        const shares = 10;
        const longPrice = prices[longSymbol];
        const shortPrice = prices[shortSymbol];

        const longSlippage = calculateSlippage(shares, longPrice);
        const shortSlippage = calculateSlippage(shares, shortPrice);

        const longCostNative = shares * (longPrice + longSlippage);
        const shortProceedsNative = shares * (shortPrice - shortSlippage);
        const longCostKrw = longStock.currency === Currency.USD ? longCostNative * exRate : longCostNative;

        if(p.cash < longCostKrw) { logActivity(TradeAction.ENTER_PAIR_TRADE, longStock, 0, 0, "자금 부족", time); return p; }
        p.cash -= longCostKrw;
        const shortProceedsKrw = shortStock.currency === Currency.USD ? shortProceedsNative * exRate : shortProceedsNative;
        p.cash += shortProceedsKrw;

        const pairId = `${shortSymbol}-${longSymbol}`;
        p.pairTrades[pairId] = { id: pairId, longStock: longSymbol, shortStock: shortSymbol, shares, entryPriceLong: longPrice, entryPriceShort: shortPrice, entrySpread: prices[shortSymbol] / prices[longSymbol], entryTime: time };
        p.holdings[longSymbol] = { shares, avgPrice: longPrice, positionType: PositionType.LONG, pairSymbol: shortSymbol };
        p.holdings[shortSymbol] = { shares, avgPrice: shortPrice, positionType: PositionType.SHORT, pairSymbol: longSymbol };
        
        logActivity(TradeAction.ENTER_PAIR_TRADE, STOCKS[longSymbol], shares, longPrice, reason, time);
        return p;
    }
    const exitPairTrade = (p: Portfolio, pairId: string, prices: { [k in StockSymbol]: number }, exRate: number, time: string): Portfolio => {
        const pair = p.pairTrades[pairId];
        if (!pair) return p;

        const { longStock: longSymbol, shortStock: shortSymbol, shares } = pair;
        const longStock = STOCKS[longSymbol];
        const shortStock = STOCKS[shortSymbol];
        
        const longPrice = prices[longSymbol];
        const shortPrice = prices[shortSymbol];
        const longSlippage = calculateSlippage(shares, longPrice);
        const shortSlippage = calculateSlippage(shares, shortPrice);

        const longProceedsNative = shares * (longPrice - longSlippage);
        const shortCostNative = shares * (shortPrice + shortSlippage);
        
        const longProceedsKrw = longStock.currency === Currency.USD ? longProceedsNative * exRate : longProceedsNative;
        const shortCostKrw = shortStock.currency === Currency.USD ? shortCostNative * exRate : shortCostNative;
        
        if(p.cash + longProceedsKrw < shortCostKrw) { logActivity(TradeAction.EXIT_PAIR_TRADE, longStock, 0, 0, "자금 부족", time); return p; }
        
        p.cash += longProceedsKrw;
        p.cash -= shortCostKrw;

        delete p.holdings[longSymbol];
        delete p.holdings[shortSymbol];
        delete p.pairTrades[pairId];
        
        logActivity(TradeAction.EXIT_PAIR_TRADE, STOCKS[longSymbol], shares, longPrice, "페어 트레이드 청산", time);
        return p;
    }


    useEffect(() => {
        if (isRunning) {
            const interval = setInterval(runSimulationStep, 2000); 
            return () => clearInterval(interval);
        }
    }, [isRunning, runSimulationStep]);
    
    const toggleSimulation = () => setIsRunning(!isRunning);

    const currentPrices = (Object.keys(STOCKS) as StockSymbol[]).reduce((acc, symbol) => {
        const data = chartData[symbol];
        acc[symbol] = data && data.length > 0 ? data[data.length - 1].close : 0;
        return acc;
    }, {} as { [key in StockSymbol]: number });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <ControlPanel 
                        isRunning={isRunning}
                        isLoading={isLoading}
                        onToggleSimulation={toggleSimulation}
                        currentDate={currentDate}
                        marketRegime={marketRegime}
                        activeStrategy={activeStrategy}
                        strategyReason={strategyReason}
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
                     <AiAnalysisFactors 
                      analysis={currentAnalysis} 
                      activeStrategy={activeStrategy}
                      pairsSignal={pairsSignal}
                    />
                    <ActivityLog activities={activityLog} isLoading={isLoading} />
                </div>
            </div>
            <IndividualCharts allChartData={chartData} activities={activityLog} />
        </div>
    );
};

export default Dashboard;