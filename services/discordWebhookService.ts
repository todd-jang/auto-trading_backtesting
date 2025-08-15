import { AITradeSignal, Stock, TradeAction, HedgeFundStrategy, PairsTradingSignal, StockSymbol, Currency } from '../types';
import { STOCKS } from '../constants';

const formatCurrency = (value: number, currency: Currency) => {
    const options = {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === Currency.USD ? 2 : 0,
        maximumFractionDigits: currency === Currency.USD ? 2 : 0,
    };
    return new Intl.NumberFormat(currency === Currency.USD ? 'en-US' : 'ko-KR', options).format(value);
};

const getActionColor = (action: string): number => {
    switch (action.toUpperCase()) {
        case 'BUY': return 3066993; // Green
        case 'SELL': return 15158332; // Red
        case 'SHORT': return 15105570; // Darker Red
        case 'COVER': return 3447003; // Blue
        case 'ENTER_PAIR_TRADE': return 15844367; // Yellow/Amber
        case 'EXIT_PAIR_TRADE': return 7419530; // Gray
        case 'HOLD':
        default: return 9807270; // Grayple
    }
};

export const sendTradeNotification = async (
    signal: AITradeSignal | PairsTradingSignal,
    activeStrategy: HedgeFundStrategy,
    price?: number, // for non-pair trades
    stock?: Stock, // for non-pair trades
): Promise<void> => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        // console.warn("DISCORD_WEBHOOK_URL environment variable not set. Skipping notification.");
        return;
    }

    let embed;

    if ('zScore' in signal) { // It's a PairsTradingSignal
        const { action, longStock, shortStock, reason, zScore } = signal;
        embed = {
            title: `📈 페어 트레이딩 신호: ${action.replace(/_/g, ' ')}`,
            description: `**사유**: ${reason}`,
            color: getActionColor(action),
            fields: [
                { name: '전략', value: activeStrategy, inline: true },
                { name: 'Z-Score', value: zScore.toFixed(4), inline: true },
                { name: 'Long', value: STOCKS[longStock].koreanName, inline: true },
                { name: 'Short', value: STOCKS[shortStock].koreanName, inline: true },
            ],
            timestamp: new Date().toISOString(),
        };
    } else if (stock && price) { // It's a regular AITradeSignal
        const { decision, sharesToTrade, reason, confidence } = signal;
        if (decision === TradeAction.HOLD) return; // Don't send for HOLD signals

        const totalValue = sharesToTrade * price;

        embed = {
            title: `🤖 AI 거래 신호: ${decision} ${stock.koreanName}`,
            description: `**사유**: ${reason}`,
            color: getActionColor(decision),
            fields: [
                { name: '전략', value: activeStrategy, inline: true },
                { name: '종목', value: `${stock.name} (${stock.symbol})`, inline: true },
                { name: '수량', value: sharesToTrade.toLocaleString(), inline: true },
                { name: '가격', value: formatCurrency(price, stock.currency), inline: true },
                { name: '총 금액', value: formatCurrency(totalValue, stock.currency), inline: true },
                { name: '신뢰도', value: `${(confidence * 100).toFixed(1)}%`, inline: true },
            ],
            timestamp: new Date().toISOString(),
        };
    } else {
        return; // Invalid signal type
    }

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: 'AI Trading Engine',
                avatar_url: 'https://i.imgur.com/4M34hi2.png',
                embeds: [embed],
            }),
        });
    } catch (error) {
        console.error("Failed to send Discord notification:", error);
    }
};
