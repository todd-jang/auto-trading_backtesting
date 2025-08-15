import { StockSymbol, TradeAction, OrderConfirmation } from '../types';

interface OrderRequest {
    symbol: StockSymbol;
    action: TradeAction;
    shares: number;
    price: number; // For market orders, this is the last known price
}

/**
 * Simulates executing a trade through a brokerage API.
 * Includes simulated network latency and slippage.
 */
export const executeLiveTrade = (order: OrderRequest): Promise<OrderConfirmation> => {
    return new Promise(resolve => {
        // 1. Simulate network latency (e.g., 50-200ms)
        const latency = 50 + Math.random() * 150;

        setTimeout(() => {
            // 2. Simulate slippage (more for larger orders)
            const slippagePercent = (Math.random() - 0.5) * 0.0005 * (order.shares / 100);
            const filledPrice = parseFloat((order.price * (1 + slippagePercent)).toFixed(2));
            
            // 3. Simulate order success/failure (98% success rate)
            const isSuccess = Math.random() < 0.98;
            
            const confirmation: OrderConfirmation = {
                orderId: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                symbol: order.symbol,
                action: order.action,
                shares: order.shares,
                filledPrice: filledPrice,
                timestamp: Date.now(),
                status: isSuccess ? 'SUCCESS' : 'FAILED',
                reason: isSuccess ? undefined : 'Market closed or insufficient liquidity',
            };
            
            resolve(confirmation);
        }, latency);
    });
};
