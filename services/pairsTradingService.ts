import { ChartDataPoint, StockSymbol, TradeAction } from "../types";

export interface PairsTradingSignal {
    action: TradeAction.ENTER_PAIR_TRADE | TradeAction.EXIT_PAIR_TRADE;
    longStock: StockSymbol;
    shortStock: StockSymbol;
    reason: string;
    zScore: number;
}

const PAIR = {
    stock1: StockSymbol.MICRON,
    stock2: StockSymbol.HYNIX
};
const Z_SCORE_THRESHOLD = 2.0;
const MOVING_AVERAGE_PERIOD = 30;

export const getPairsTradingSignal = (
    history1: ChartDataPoint[],
    history2: ChartDataPoint[]
): PairsTradingSignal | null => {
    if (history1.length < MOVING_AVERAGE_PERIOD || history2.length < MOVING_AVERAGE_PERIOD) {
        return null;
    }

    // Ensure data points align by time - a simple approach
    const ratios: number[] = [];
    for (let i = 0; i < history1.length; i++) {
        const p1 = history1[i]?.price;
        const p2 = history2.find(p => p.time === history1[i].time)?.price;
        if (p1 && p2 && p2 > 0) {
            ratios.push(p1 / p2);
        }
    }

    if (ratios.length < MOVING_AVERAGE_PERIOD) return null;

    const recentRatios = ratios.slice(-MOVING_AVERAGE_PERIOD);
    const mean = recentRatios.reduce((sum, val) => sum + val, 0) / MOVING_AVERAGE_PERIOD;
    const stdDev = Math.sqrt(recentRatios.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / MOVING_AVERAGE_PERIOD);
    
    if (stdDev === 0) return null;

    const currentRatio = ratios[ratios.length - 1];
    const zScore = (currentRatio - mean) / stdDev;

    // Signal to ENTER a trade
    if (zScore > Z_SCORE_THRESHOLD) {
        // Ratio is high, so stock1 is overvalued relative to stock2. Short stock1, long stock2.
        return {
            action: TradeAction.ENTER_PAIR_TRADE,
            longStock: PAIR.stock2,
            shortStock: PAIR.stock1,
            zScore: zScore,
            reason: `Pairs Arb: Spread Z-Score (${zScore.toFixed(2)}) > ${Z_SCORE_THRESHOLD}. Short ${PAIR.stock1}, Long ${PAIR.stock2}.`
        };
    }
    if (zScore < -Z_SCORE_THRESHOLD) {
        // Ratio is low, so stock1 is undervalued. Long stock1, short stock2.
        return {
            action: TradeAction.ENTER_PAIR_TRADE,
            longStock: PAIR.stock1,
            shortStock: PAIR.stock2,
            zScore: zScore,
            reason: `Pairs Arb: Spread Z-Score (${zScore.toFixed(2)}) < -${Z_SCORE_THRESHOLD}. Long ${PAIR.stock1}, Short ${PAIR.stock2}.`
        };
    }
    
    // Signal to EXIT a trade (mean reversion)
    if (Math.abs(zScore) < 0.5) {
        return {
            action: TradeAction.EXIT_PAIR_TRADE,
            longStock: PAIR.stock1, // Stocks are just placeholders here
            shortStock: PAIR.stock2,
            zScore: zScore,
            reason: `Pairs Arb: Spread Z-Score (${zScore.toFixed(2)}) has reverted to mean. Close position.`
        };
    }

    return null;
};
