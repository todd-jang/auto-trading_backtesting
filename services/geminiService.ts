import { GoogleGenAI, Type } from "@google/genai";
import { Stock, ChartDataPoint, Portfolio, TradeAction, Currency, AlphaFactors, Trend, HedgeFundStrategy, MarketRegime, FundamentalData, AITradeSignal, MlFeatures } from '../types';

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
    portfolioValue: number,
    isAggressiveMode: boolean,
    isLowLatencyMode: boolean,
): Promise<{ strategy: HedgeFundStrategy; reason: string; }> => {
    const prompt = `
        You are the Chief Investment Officer (CIO) of a sophisticated hedge fund.
        Your job is to set the high-level trading strategy based on the overall market conditions (regime).
        
        **Current Mandate**: ${isAggressiveMode ? 'AGGRESSIVE INVESTMENT' : 'STANDARD'}.
        ${isAggressiveMode ? "In Aggressive mode, you should favor strategies with higher potential returns like 'Alpha Momentum' or 'Deep Hedging'. Avoid 'Risk Off' unless market conditions are extremely dire." : ""}

        Available Strategies:
        - "${HedgeFundStrategy.ALPHA_MOMENTUM}": Best for TRENDING markets. Focus on buying strong stocks and shorting weak ones based on alpha scores.
        - "${HedgeFundStrategy.PAIRS_TRADING}": Best for RANGING or LOW_VOLATILITY markets. A market-neutral strategy focusing on statistical arbitrage opportunities.
        - "${HedgeFundStrategy.MEAN_REVERSION}": Best for RANGING markets. Aims to buy oversold assets and sell overbought ones.
        - "${HedgeFundStrategy.DEEP_HEDGING}": An advanced strategy using a Machine Learning model for predictive signals. Best for RANGING or highly volatile markets where traditional factors are unreliable.
        - "${HedgeFundStrategy.RISK_OFF}": The safest option. Use in volatile or uncertain conditions. Liquidates positions and holds cash.

        Current Market Analysis:
        - **Market Regime**: ${regime}
        - **Total Portfolio Value**: ₩${portfolioValue.toLocaleString()}

        Based on this regime, which single strategy should our fund deploy? Provide your response in the required JSON format.
    `;
    try {
        const config: any = {
            responseMimeType: "application/json",
            responseSchema: cioResponseSchema,
            temperature: 0.5
        };

        if (isLowLatencyMode) {
            config.thinkingConfig = { thinkingBudget: 0 };
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: config
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Error fetching CIO strategic allocation:", error);
        return { strategy: HedgeFundStrategy.RISK_OFF, reason: "AI CIO error, defaulting to safety." };
    }
};


// --- AI #2: Analyst / Fund Manager ---

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
            description: 'Number of shares to trade (multiple of 10). 0 for HOLD.'
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
    trend: Trend,
    fundamentals: FundamentalData,
    isAggressiveMode: boolean,
    isLowLatencyMode: boolean,
): Promise<AITradeSignal> => {
     const maxShares = isAggressiveMode ? 200 : 100;
     const prompt = `
        You are a quantitative analyst at a hedge fund. Your CIO has set the active strategy. Your task is to analyze a single stock within this strategic framework and generate a trade signal by synthesizing technical, fundamental, and trend data.

        **CIO's Mandate (Active Strategy): ${activeStrategy}**
        **Execution Style**: ${isAggressiveMode ? 'AGGRESSIVE. Be more decisive and trade larger volumes when confidence is high.' : 'STANDARD'}

        **Analysis Rules:**
        - If Strategy is "${HedgeFundStrategy.ALPHA_MOMENTUM}": Focus on the Composite Alpha Score and Trend. High score + UPTREND = BUY. Low score + DOWNTREND = SHORT.
        - If Strategy is "${HedgeFundStrategy.MEAN_REVERSION}": Focus on the Mean Reversion score. High score (>70) suggests 'overbought' (SELL/SHORT). Low score (<30) suggests 'oversold' (BUY).
        - **Crucially, consider the Fundamental Data.** Strong fundamentals (e.g., high EPS growth, reasonable P/E) should increase your confidence in BUY signals, especially in a confirmed 'UPTREND'. Weak fundamentals justify more caution.
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

        **Fundamental Data:**
        - P/E Ratio: ${fundamentals.peRatio.toFixed(1)}
        - EPS Growth (YoY): ${fundamentals.epsGrowth.toFixed(1)}%
        - Debt-to-Equity: ${fundamentals.debtToEquity.toFixed(2)}
        
        Based on your holistic analysis and adhering strictly to the CIO's strategy, provide your recommendation in the required JSON format. The maximum shares to trade is ${maxShares}.
    `;
    
    try {
        const config: any = {
            responseMimeType: "application/json",
            responseSchema: analystResponseSchema,
            temperature: 0.7
        };

        if (isLowLatencyMode) {
            config.thinkingConfig = { thinkingBudget: 0 };
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: config
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
            if (parsedResponse.sharesToTrade > maxShares) parsedResponse.sharesToTrade = maxShares;
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

// --- AI #3: ML Inference Model ---
const mlInferenceResponseSchema = {
    type: Type.OBJECT,
    properties: {
        decision: {
            type: Type.STRING,
            enum: [TradeAction.BUY, TradeAction.SELL, TradeAction.HOLD],
            description: 'The short-term trading action based on ML features and a 0.7 confidence threshold.'
        },
        sharesToTrade: {
            type: Type.INTEGER,
            description: 'Number of shares to trade (multiple of 10). 0 for HOLD.'
        },
        reason: {
            type: Type.STRING,
            description: 'A brief, data-driven reason for the decision, referencing the input features.'
        },
        confidence: {
            type: Type.NUMBER,
            description: 'The highest probability from the softmax output for the predicted class.'
        },
        softmaxProbabilities: {
            type: Type.OBJECT,
            properties: {
                buy: { type: Type.NUMBER, description: 'Softmax probability for BUY. Must sum to 1 with sell and hold.' },
                sell: { type: Type.NUMBER, description: 'Softmax probability for SELL. Must sum to 1 with buy and hold.' },
                hold: { type: Type.NUMBER, description: 'Softmax probability for HOLD. Must sum to 1 with buy and sell.' }
            },
            required: ["buy", "sell", "hold"]
        }
    },
    required: ["decision", "sharesToTrade", "reason", "confidence", "softmaxProbabilities"],
};


export const getMlInferenceSignal = async (
    stock: Stock,
    features: MlFeatures,
    isAggressiveMode: boolean,
    isLowLatencyMode: boolean,
): Promise<AITradeSignal> => {
     const maxShares = isAggressiveMode ? 150 : 70; // Different scaling for ML model
     const prompt = `
        You are an AI emulating a time-series Machine Learning model. The final layer of this model is a \`softmax\` function, which outputs probabilities for three actions: BUY, SELL, HOLD.

        Your task is to analyze a set of pre-calculated features and output a trading signal in JSON format.
        You must be objective and data-driven. Your reasoning should directly reference the provided feature data.

        **Model Architecture & Decision Rule:**
        1.  Analyze the input features to determine the likelihood of an upward, downward, or neutral price movement.
        2.  Generate \`softmax\` probabilities for BUY, SELL, and HOLD. The sum of these three probabilities MUST equal 1.0.
        3.  The model's decision rule is to select the action with the highest probability, but ONLY if that probability is >= 0.7 (the \`threshold\`).
        4.  If the highest probability is less than 0.7, the final decision MUST be \`HOLD\` to filter out low-confidence signals, regardless of which class had the highest probability.
        5.  The \`confidence\` score in the output must be the probability of the class with the highest score.

        **Execution Style**: ${isAggressiveMode ? 'AGGRESSIVE. Trade larger volumes when confidence is high.' : 'STANDARD'}

        **Input Features:**
        - Stock: ${stock.name} (${stock.koreanName})
        - 5-minute Price Change: ${features.priceChange5m.toFixed(3)}%
        - 20-minute Price Change: ${features.priceChange20m.toFixed(3)}%
        - 10-minute Volatility: ${features.volatility10m.toFixed(3)}%
        - 14-period RSI: ${features.rsi14m.toFixed(2)}

        **Inference Logic Guide:**
        - Strong positive momentum (both 5m and 20m price changes are positive) with RSI not yet overbought (e.g., < 75) suggests a high BUY probability.
        - Strong negative momentum with RSI not yet oversold (e.g., > 25) suggests a high SELL probability.
        - High volatility with RSI in overbought (>75) or oversold (<25) territory suggests a potential reversal (high SELL or BUY probability, respectively).
        - Conflicting signals (e.g., positive 5m change but negative 20m change) should lead to lower confidence and likely a high HOLD probability.

        Based on your inference, provide a trading signal. The maximum shares to trade is ${maxShares}. Your reason must be concise and include specific feature values.
    `;
    
    try {
        const config: any = {
            responseMimeType: "application/json",
            responseSchema: mlInferenceResponseSchema,
            temperature: 0.3 // ML models should be less creative
        };
        
        if (isLowLatencyMode) {
            config.thinkingConfig = { thinkingBudget: 0 };
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: config
        });

        let parsedResponse: AITradeSignal = JSON.parse(response.text.trim());
        
        // --- Stronger Validation based on new rules ---
        if (parsedResponse.softmaxProbabilities) {
            const { buy, sell, hold } = parsedResponse.softmaxProbabilities;
            const maxProb = Math.max(buy, sell, hold);

            if (maxProb < 0.7) {
                if (parsedResponse.decision !== TradeAction.HOLD) {
                    parsedResponse.decision = TradeAction.HOLD;
                    parsedResponse.reason = `Threshold not met (max prob: ${maxProb.toFixed(2)}). Overriding to HOLD. Original reason: ${parsedResponse.reason}`;
                }
            } else {
                const predictedAction = buy === maxProb ? TradeAction.BUY : sell === maxProb ? TradeAction.SELL : TradeAction.HOLD;
                if (parsedResponse.decision !== predictedAction) {
                    parsedResponse.decision = predictedAction;
                    parsedResponse.reason = `Decision corrected to match highest probability. Original reason: ${parsedResponse.reason}`;
                }
            }
        }
        
        // --- Standard Validation ---
        if (parsedResponse.decision === TradeAction.HOLD) {
            parsedResponse.sharesToTrade = 0;
        } else {
            parsedResponse.sharesToTrade = Math.round(Math.max(0, parsedResponse.sharesToTrade) / 10) * 10;
            if (parsedResponse.sharesToTrade > maxShares) parsedResponse.sharesToTrade = maxShares;
        }

        return parsedResponse;

    } catch (error) {
        console.error(`Error fetching ML Inference signal for ${stock.symbol}:`, error);
        return {
            decision: TradeAction.HOLD,
            reason: "ML Inference AI error.",
            sharesToTrade: 0,
            confidence: 0,
            softmaxProbabilities: { buy: 0, sell: 0, hold: 1.0 }
        };
    }
};