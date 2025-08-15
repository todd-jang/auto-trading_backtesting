import { ChartDataPoint, MlSignal } from '../types';

// Let TypeScript know that 'tf' is a global variable from the CDN script
declare var tf: any;

let model: any | null = null; // tf.Sequential

/**
 * Initializes a more realistic placeholder TensorFlow.js model with an LSTM layer.
 */
export const initializeModel = async () => {
    if (typeof tf === 'undefined') {
        console.error("TensorFlow.js not loaded. Make sure the script is in index.html.");
        return;
    }
    
    if (model) {
        console.log("TF.js model already initialized.");
        return;
    }

    console.log("Initializing TF.js LSTM model...");
    // Define a simple sequential model for demonstration
    model = tf.sequential();
    // Adding an LSTM layer suitable for time-series data
    model.add(tf.layers.lstm({units: 16, inputShape: [10, 1], returnSequences: false})); // Input: e.g., last 10 prices (timesteps, features)
    model.add(tf.layers.dense({units: 8, activation: 'relu'}));
    model.add(tf.layers.dense({units: 3, activation: 'softmax'})); // Output: Probabilities for BUY, SELL, HOLD
    
    model.compile({loss: 'categoricalCrossentropy', optimizer: 'adam'});
    
    console.log("TF.js LSTM model initialized (placeholder).");
    model.summary();
};

const calculateVolatility = (data: number[]): number => {
    const n = data.length;
    if (n < 2) return 0;
    const mean = data.reduce((a, b) => a + b) / n;
    const variance = data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / (n - 1);
    return Math.sqrt(variance);
};


/**
 * Gets a prediction from the ML model.
 * This is a placeholder that simulates a prediction. A real implementation
 * would preprocess the input data into a tensor and feed it to the model.
 * @param data - The historical chart data for a stock.
 * @returns An MlSignal object with a predicted action, confidence, and feature importance.
 */
export const getMlSignal = (data: ChartDataPoint[]): MlSignal => {
    const LOOK_BACK_PERIOD = 20;
    if (!model || data.length < LOOK_BACK_PERIOD) {
        return { 
            action: 'HOLD', 
            confidence: 0, 
            predictedPriceChangePercent: 0,
            featureImportance: { Volatility: 0.5, Momentum: 0.5 }
        };
    }
    
    // --- This is a mock prediction ---
    // In a real scenario, you would normalize data and use model.predict()
    
    const recentData = data.slice(-LOOK_BACK_PERIOD);
    const prices = recentData.map(p => p.price);
    const latestPrice = prices[prices.length - 1];
    
    // 1. Simulate feature extraction
    const momentum = (latestPrice - prices[0]) / prices[0]; // Simple momentum over the period
    const volatility = calculateVolatility(prices.slice(-10)) / latestPrice; // Volatility of last 10 periods
    
    // 2. Simulate model prediction based on extracted features
    let predictedChange = 0;
    // Simple logic: if momentum is strong, predict it continues. If volatility is high, predict mean reversion.
    if (volatility > 0.015) { // High volatility
      predictedChange = -momentum * 0.1; // Predict reversion
    } else { // Low volatility
      predictedChange = momentum * 0.3; // Predict trend continuation
    }

    // Add some noise
    predictedChange += (Math.random() - 0.5) * 0.005;

    // 3. Determine action and confidence
    const confidence = Math.random() * 0.4 + 0.55; // Confidence between 0.55 and 0.95
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    if (predictedChange > 0.001) {
        action = 'BUY';
    } else if (predictedChange < -0.001) {
        action = 'SELL';
    }

    // 4. Mock feature importance
    const totalFactor = Math.abs(momentum) + volatility;
    const featureImportance = {
        Momentum: totalFactor > 0 ? Math.abs(momentum) / totalFactor : 0.5,
        Volatility: totalFactor > 0 ? volatility / totalFactor : 0.5,
    };

    return {
        action,
        confidence,
        predictedPriceChangePercent: predictedChange * 100,
        featureImportance
    };
};