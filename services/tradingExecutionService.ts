import { StockSymbol, TradeAction, OrderConfirmation } from '../types';

interface OrderRequest {
    symbol: StockSymbol;
    action: TradeAction;
    shares: number;
    price: number;
}

export const executeLiveTrade = async (order: OrderRequest): Promise<OrderConfirmation> => {
    try {
        const response = await fetch('/api/execute-trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.reason || 'Trade execution failed');
        }
        return await response.json();
    } catch (error) {
        console.error("Error executing trade:", error);
        return {
            orderId: `err_${Date.now()}`,
            symbol: order.symbol,
            action: order.action,
            shares: order.shares,
            filledPrice: order.price,
            timestamp: Date.now(),
            status: 'FAILED',
            reason: (error as Error).message || 'Client-side error',
        };
    }
};
