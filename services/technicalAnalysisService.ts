import { ChartDataPoint, TradeAction } from '../types';
import { calculateSMA } from './movingAverage';

export const SHORT_MA_PERIOD = 5;
export const LONG_MA_PERIOD = 20;

export interface MovingAverageSignal {
    action: TradeAction.BUY | TradeAction.SELL;
    reason: string;
}

export const getMovingAverageCrossSignal = (history: ChartDataPoint[]): MovingAverageSignal | null => {
    if (history.length < LONG_MA_PERIOD + 1) {
        return null;
    }

    const currentShortMA = calculateSMA(history, SHORT_MA_PERIOD);
    const currentLongMA = calculateSMA(history, LONG_MA_PERIOD);
    
    const prevHistory = history.slice(0, history.length - 1);
    const prevShortMA = calculateSMA(prevHistory, SHORT_MA_PERIOD);
    const prevLongMA = calculateSMA(prevHistory, LONG_MA_PERIOD);

    if (!currentShortMA || !currentLongMA || !prevShortMA || !prevLongMA) {
        return null;
    }

    // Golden Cross: Short-term MA crosses above Long-term MA
    if (prevShortMA <= prevLongMA && currentShortMA > currentLongMA) {
        return {
            action: TradeAction.BUY,
            reason: `Golden Cross (${SHORT_MA_PERIOD}MA > ${LONG_MA_PERIOD}MA)`,
        };
    }

    // Dead Cross: Short-term MA crosses below Long-term MA
    if (prevShortMA >= prevLongMA && currentShortMA < currentLongMA) {
        return {
            action: TradeAction.SELL,
            reason: `Dead Cross (${SHORT_MA_PERIOD}MA < ${LONG_MA_PERIOD}MA)`,
        };
    }
    
    return null; // No signal
};
