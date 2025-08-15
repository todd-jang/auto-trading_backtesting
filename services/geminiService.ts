import { GoogleGenAI, Type } from "@google/genai";
import { Stock, ChartDataPoint, Portfolio, TradeAction, Currency, AlphaFactors, Trend, HedgeFundStrategy, MarketRegime, FundamentalData, AITradeSignal, MlFeatures, StockSymbol } from '../types';

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
                HedgeFundStrategy.JOCODING_MA_CROSS,
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
        - "${HedgeFundStrategy.JOCODING_MA_CROSS}": A classic rule-based strategy. Best for clearly TRENDING markets. It buys on a "Golden Cross" (short MA crosses above long MA) and sells on a "Dead Cross". Simple and fast, but can be whipsawed in RANGING markets.
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
     let sectorContextPrompt = '';
     const stockSymbol = stock.symbol;

     if ([StockSymbol.SAMSUNG, StockSymbol.HYNIX, StockSymbol.MICRON, StockSymbol.CXMT].includes(stockSymbol)) {
         sectorContextPrompt += `
        **Sector-Specific Context (Memory Market):**
        This stock operates in the highly competitive memory semiconductor market. When forming your judgment, consider its standing relative to its peers. Use the following expert-assessed weights to guide your reasoning on the stock's market influence and potential.

        **1. High-Bandwidth Memory (HBM) - Crucial for AI accelerators:**
        - SK Hynix: 70% (Current market leader, strong NVIDIA partnership)
        - Micron: 20% (Rapidly emerging player, gaining traction)
        - Samsung: 10% (Major challenger, aiming to increase share)

        **2. General-Purpose Memory (DRAM/NAND):**
        - SK Hynix: 40% (Strong #2 position, technology leader)
        - Samsung: 30% (Historical market leader, massive scale)
        - Micron: 20% (Significant US-based player)
        - CXMT: 10% (China's key domestic player, growing influence)

        Apply this context to your analysis. For instance, a strong positive signal for a market leader in a key growth area like HBM (e.g., SK Hynix) should be treated with higher conviction and confidence. A signal for a challenger may require more supporting evidence.
        `;
     }

     if (stockSymbol === StockSymbol.NVIDIA) {
         sectorContextPrompt += `
        **Sector-Specific Context (GPU Market):**
        NVIDIA holds a near-monopolistic position in the high-performance GPU market, which is critical for AI development. Our internal analysis projects this **exclusive dominance will continue for at least the next 3 years.** This provides a powerful long-term tailwind. Any short-term negative signals should be weighed against this overwhelming market position. A 'BUY' signal on NVIDIA, especially in an uptrend, can be acted upon with very high confidence.
        `;
     }

     if ([StockSymbol.TSMC, StockSymbol.SAMSUNG].includes(stockSymbol)) {
         sectorContextPrompt += `
        **Sector-Specific Context (Foundry Market):**
        This stock is a key player in the semiconductor foundry business. The market share for advanced nodes is distributed as follows:
        - **TSMC: 80%** (Undisputed market leader with premier technology and client base)
        - **Samsung: 10%** (The primary challenger, investing heavily to catch up)
        - **Others: 10%**

        When analyzing TSMC, its 80% market share implies immense stability, pricing power, and a deep moat; treat its signals with high conviction. When analyzing Samsung's foundry business, its 10% share positions it as a high-risk, high-reward challenger. Positive news for Samsung's foundry could have an outsized impact, but it faces a steep climb against the incumbent.
        `;
     }


     const prompt = `
        You are a quantitative analyst at a hedge fund. Your CIO has set the active strategy. Your task is to analyze a single stock within this strategic framework and generate a trade signal by synthesizing technical, fundamental, and trend data.

        **CIO's Mandate (Active Strategy): ${activeStrategy}**
        **Execution Style**: ${isAggressiveMode ? 'AGGRESSIVE. Be more decisive and trade larger volumes when confidence is high.' : 'STANDARD'}

        **Analysis Rules:**
        - If Strategy is "${HedgeFundStrategy.ALPHA_MOMENTUM}": Focus on the Composite Alpha Score and Trend. High score + UPTREND = BUY. Low score + DOWNTREND = SHORT.
        - If Strategy is "${HedgeFundStrategy.MEAN_REVERSION}": Focus on the Mean Reversion score. High score (>70) suggests 'overbought' (SELL/SHORT). Low score (<30) suggests 'oversold' (BUY).
        - **Crucially, consider the Fundamental Data.** Strong fundamentals (e.g., high EPS growth, reasonable P/E) should increase your confidence in BUY signals, especially in a confirmed 'UPTREND'. Weak fundamentals justify more caution.
        - Strongly prefer BUY recommendations only when the stock is in a confirmed 'UPTREND'. You may override this rule if fundamentals are exceptionally strong or a compelling mean-reversion opportunity exists, but you must clearly state the reason for the exception in your 'reason' field.
        - Similarly, strongly prefer SHORT recommendations only in a confirmed 'DOWNTREND', with the same possibility for justified exceptions.
        
        ${sectorContextPrompt}

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