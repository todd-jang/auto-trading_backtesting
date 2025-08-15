// A mock service to simulate fetching a real-time USD/KRW exchange rate.
let currentExchangeRate = 1380.00;

export const getExchangeRate = async (): Promise<number> => {
    // In a real app, this would be an API call.
    // Here, we simulate some fluctuation.
    const fluctuation = (Math.random() - 0.5) * 5; // Fluctuate by +/- 2.5 KRW
    currentExchangeRate += fluctuation;
    return Promise.resolve(parseFloat(currentExchangeRate.toFixed(2)));
};
