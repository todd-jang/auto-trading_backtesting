
import { HedgeFundStrategy, MarketRegime, AITradeSignal, Stock, AlphaFactors, Trend, FundamentalData, MlFeatures, TradeAction } from '../types';

export const getStrategicAllocation = async (
    regime: MarketRegime,
    portfolioValue: number,
    isAggressiveMode: boolean,
    isLowLatencyMode: boolean,
): Promise<{ strategy: HedgeFundStrategy; reason: string; }> => {
    try {
        const response = await fetch('/api/cio-strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regime, portfolioValue, isAggressiveMode, isLowLatencyMode }),
        });
        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching CIO strategic allocation:", error);
        return { strategy: HedgeFundStrategy.RISK_OFF, reason: "API client error, defaulting to safety." };
    }
};

export const getAiTradeSignal = async (
    stock: Stock,
    activeStrategy: HedgeFundStrategy,
    factors: AlphaFactors,
    trend: Trend,
    fundamentals: FundamentalData,
    isAggressiveMode: boolean,
    isLowLatencyMode: boolean,
): Promise<AITradeSignal> => {
     try {
        const response = await fetch('/api/trade-signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock, activeStrategy, factors, trend, fundamentals, isAggressiveMode, isLowLatencyMode }),
        });
        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching Analyst signal for ${stock.symbol}:`, error);
        return {
            decision: TradeAction.HOLD,
            reason: "Analyst API client error.",
            sharesToTrade: 0,
            confidence: 0
        };
    }
};


export const getMlInferenceSignal = async (
    stock: Stock,
    features: MlFeatures,
    isAggressiveMode: boolean,
    isLowLatencyMode: boolean,
): Promise<AITradeSignal> => {
    try {
        const response = await fetch('/api/ml-signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock, features, isAggressiveMode, isLowLatencyMode }),
        });
        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ML Inference signal for ${stock.symbol}:`, error);
        return {
            decision: TradeAction.HOLD,
            reason: "ML Inference API client error.",
            sharesToTrade: 0,
            confidence: 0,
            softmaxProbabilities: { buy: 0, sell: 0, hold: 1.0 }
        };
    }
};