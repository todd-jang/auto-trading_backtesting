
import { GoogleGenAI, Type } from "@google/genai";
import { Stock, ChartDataPoint, Portfolio, TradeAction, Currency, AlphaFactors, Trend, HedgeFundStrategy, MarketRegime } from '../types';

if (!process.env.API_KEY) {
  console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
const model = "gemini-2.5-flash";

// --- AI #1: Chief Investment Officer (CIO) ---

const cioResponseSchema = {
    type: Type.OBJECT,
    properties: {
        strategy: {
            type: Type.STRING,
            enum: [
                HedgeFundStrategy.ALPHA_MOMENTUM, 
                HedgeFundStrategy.PAIRS_TRADING, 
                HedgeFundStrategy.MEAN_REVERSION,
                HedgeFundStrategy.RISK_OFF,
                HedgeFundStrategy.DEEP_HEDGING,
            ],
        },
        reason: {
            type: Type.STRING,
            description: 'Briefly explain why this strategy is best for the current market regime.'
        }
    },
    required: ["strategy", "reason"],
};

export const getStrategicAllocation = async (
    regime: MarketRegime,
    portfolioValue: number
): Promise<{ strategy: HedgeFundStrategy; reason: string; }> => {
    const prompt = `
        You are the Chief Investment Officer (CIO) of a sophisticated hedge fund.
        Your job is to set the high-level trading strategy based on the overall market conditions (regime).
        
        Available Strategies:
        - "${HedgeFundStrategy.ALPHA_MOMENTUM}": Best for TRENDING markets. Focus on buying strong stocks and shorting weak ones based on alpha scores.
        - "${HedgeFundStrategy.PAIRS_TRADING}": Best for RANGING or LOW_VOLATILITY markets. A market-neutral strategy focusing on statistical arbitrage opportunities.
        - "${HedgeFundStrategy.MEAN_REVERSION}": Best for RANGING markets. Aims to buy oversold assets and sell overbought ones.
        - "${HedgeFundStrategy.DEEP_HEDGING}": An advanced strategy using a TensorFlow.js model for predictive hedging. Best for RANGING or highly volatile markets where traditional factors are unreliable.
        - "${HedgeFundStrategy.RISK_OFF}": The safest option. Use in volatile or uncertain conditions. Liquidates positions and holds cash.

        Current Market Analysis:
        - **Market Regime**: ${regime}
        - **Total Portfolio Value**: ₩${portfolioValue.toLocaleString()}

        Based on this regime, which single strategy should our fund deploy? Provide your response in the required JSON format.
    `;
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: cioResponseSchema,
                temperature: 0.5
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Error fetching CIO strategic allocation:", error);
        return { strategy: HedgeFundStrategy.RISK_OFF, reason: "AI CIO error, defaulting to safety." };
    }
};


// --- AI #2: Analyst / Fund Manager ---

export interface AITradeSignal {
    decision: TradeAction;
    reason: string;
    sharesToTrade: number;
    confidence: number; // 0-1 confidence score
}

const analystResponseSchema = {
    type: Type.OBJECT,
    properties: {
        decision: { 
            type: Type.STRING,
            enum: [TradeAction.BUY, TradeAction.SELL, TradeAction.HOLD, TradeAction.SHORT, TradeAction.COVER],
            description: 'The trading action to take for this specific stock.'
        },
        sharesToTrade: {
            type: Type.INTEGER,
            description: 'Number of shares to trade (multiple of 10, max 100). 0 for HOLD.'
        },
        reason: {
            type: Type.STRING,
            description: 'Briefly explain the decision based on the Alpha Factors and the active strategy.'
        },
        confidence: {
            type: Type.NUMBER,
            description: 'A score from 0.0 to 1.0 indicating your confidence in this trade signal.'
        }
    },
    required: ["decision", "sharesToTrade", "reason", "confidence"],
};

export const getAiTradeSignal = async (
    stock: Stock,
    activeStrategy: HedgeFundStrategy,
    factors: AlphaFactors,
    trend: Trend
): Promise<AITradeSignal> => {
     const prompt = `
        You are a quantitative analyst at a hedge fund. Your CIO has set the active strategy. Your task is to analyze a single stock within this strategic framework and generate a trade signal.

        **CIO's Mandate (Active Strategy): ${activeStrategy}**

        **Analysis Rules:**
        - If Strategy is "${HedgeFundStrategy.ALPHA_MOMENTUM}": Focus on the Composite Alpha Score and Trend. High score + UPTREND = BUY. Low score + DOWNTREND = SHORT.
        - If Strategy is "${HedgeFundStrategy.MEAN_REVERSION}": Focus on the Mean Reversion score. High score (>70) suggests 'overbought' (SELL/SHORT). Low score (<30) suggests 'oversold' (BUY).
        - You are ONLY permitted to issue a BUY recommendation if the stock is in a confirmed 'UPTREND'.
        - You are ONLY permitted to issue a SHORT recommendation if the stock is in a confirmed 'DOWNTREND'.

        **Stock & Factor Data:**
        - Stock: ${stock.name} (${stock.koreanName})
        - Current Trend: ${trend}
        - **Composite Alpha Score**: ${factors.compositeAlphaScore.toFixed(1)} / 100
        - Individual Factors (0-100):
          - Value: ${factors.value.toFixed(1)}
          - Momentum: ${factors.momentum.toFixed(1)}
          - Mean Reversion: ${factors.meanReversion.toFixed(1)}
        
        Based on your analysis and adhering strictly to the CIO's strategy, provide your recommendation in the required JSON format.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: analystResponseSchema,
                temperature: 0.7
            }
        });

        let parsedResponse: AITradeSignal = JSON.parse(response.text.trim());
        
        // --- Validation ---
        if ((trend !== 'UPTREND' && parsedResponse.decision === TradeAction.BUY) || (trend !== 'DOWNTREND' && parsedResponse.decision === TradeAction.SHORT)) {
           parsedResponse.decision = TradeAction.HOLD;
           parsedResponse.sharesToTrade = 0;
           parsedResponse.reason = `Signal ignored (Trend violation): ${parsedResponse.reason}`;
        }
        
        if (parsedResponse.decision === TradeAction.HOLD) {
            parsedResponse.sharesToTrade = 0;
        } else {
            parsedResponse.sharesToTrade = Math.round(Math.max(0, parsedResponse.sharesToTrade) / 10) * 10;
            if (parsedResponse.sharesToTrade > 100) parsedResponse.sharesToTrade = 100;
        }

        return parsedResponse;

    } catch (error) {
        console.error(`Error fetching Analyst signal for ${stock.symbol}:`, error);
        return {
            decision: TradeAction.HOLD,
            reason: "Analyst AI error.",
            sharesToTrade: 0,
            confidence: 0
        };
    }
};