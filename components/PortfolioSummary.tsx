
import React from 'react';
import { Portfolio, Stock, StockSymbol, Currency, PositionType, PairTrade } from '../types';

interface PortfolioSummaryProps {
    portfolio: Portfolio;
    stocks: { [key in StockSymbol]: Stock };
    currentPrices: { [key in StockSymbol]: number };
    exchangeRate: number;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ portfolio, stocks, currentPrices, exchangeRate }) => {
    
    const holdingsValue = (Object.keys(portfolio.holdings) as StockSymbol[]).reduce((acc, symbol) => {
        const holding = portfolio.holdings[symbol];
        if (!holding) return acc;

        const stockInfo = stocks[symbol];
        const price = currentPrices[symbol] || 0;
        
        let valueInNativeCurrency;
        if (holding.positionType === PositionType.SHORT) {
             valueInNativeCurrency = -(holding.shares * price);
        } else { // LONG position
            valueInNativeCurrency = holding.shares * price;
        }
        
        const valueInKrw = stockInfo.currency === Currency.USD 
            ? valueInNativeCurrency * exchangeRate 
            : valueInNativeCurrency;

        return acc + valueInKrw;
    }, 0);
    
    const totalValue = portfolio.cash + holdingsValue;

    const formatCurrency = (value: number, currency: Currency) => {
        const options = {
            style: 'currency',
            currency,
            minimumFractionDigits: currency === Currency.USD ? 2 : 0,
            maximumFractionDigits: currency === Currency.USD ? 2 : 0,
        };
        return new Intl.NumberFormat(currency === Currency.USD ? 'en-US' : 'ko-KR', options).format(value);
    };
    
    const renderPosition = (stock: Stock, pType: PositionType, shares: number, avgPrice: number, isPair: boolean = false) => {
         const currentValue = shares * (currentPrices[stock.symbol] || 0);
         const acquisitionValue = shares * avgPrice;
         
         let profitLoss;
         if (pType === PositionType.SHORT) {
            profitLoss = acquisitionValue - currentValue;
         } else {
            profitLoss = currentValue - acquisitionValue;
         }
         
         const profitLossPercent = acquisitionValue > 0 ? (profitLoss / acquisitionValue) * 100 : 0;
         const plColor = profitLoss > 0 ? 'text-green-500 dark:text-green-400' : profitLoss < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400';

        return (
            <div key={`${stock.symbol}-${pType}`} className={`bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md ${isPair ? 'ml-4 border-l-2 border-gray-200 dark:border-gray-600 pl-4' : ''}`}>
                <div className="flex justify-between items-center font-bold">
                    <span className="text-gray-800 dark:text-white">{stock.koreanName}</span>
                    {pType === PositionType.SHORT && <span className="text-xs font-bold text-red-500 dark:text-red-400">[공매도]</span>}
                    <span className="text-gray-800 dark:text-white">{shares.toLocaleString()} 주</span>
                </div>
                <div className="flex justify-between items-baseline text-sm mt-1">
                   <span className="text-gray-500 dark:text-gray-400">평균단가</span>
                   <span className="text-gray-700 dark:text-gray-300">{formatCurrency(avgPrice, stock.currency)}</span>
                </div>
                <div className="flex justify-between items-baseline text-sm">
                   <span className="text-gray-500 dark:text-gray-400">평가손익</span>
                   <span className={plColor}>{formatCurrency(profitLoss, stock.currency)} ({profitLossPercent.toFixed(2)}%)</span>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">퀀트 포트폴리오</h2>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">총 자산 (KRW 환산)</span>
                    <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(totalValue, Currency.KRW)}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">보유 현금</span>
                    <span className="text-lg font-medium text-gray-700 dark:text-gray-200">{formatCurrency(portfolio.cash, Currency.KRW)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">주식 평가액</span>
                    <span className="text-lg font-medium text-gray-700 dark:text-gray-200">{formatCurrency(holdingsValue, Currency.KRW)}</span>
                </div>
                 <div className="text-right text-xs text-gray-400 dark:text-gray-500 mt-2">
                    환율: ₩{exchangeRate.toFixed(2)} / $1
                 </div>
            </div>

            <div className="mt-6 space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-3">Directional Positions</h3>
                {Object.values(stocks).map((stock: Stock) => {
                    const holding = portfolio.holdings[stock.symbol];
                    if (!holding || holding.shares === 0 || holding.pairSymbol) return null; // Exclude pair trade legs
                    return renderPosition(stock, holding.positionType, holding.shares, holding.avgPrice);
                })}
            </div>
            
            <div className="mt-6 space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-3">Pairs Trades</h3>
                 {Object.values(portfolio.pairTrades).map((pair: PairTrade) => {
                     const longHolding = portfolio.holdings[pair.longStock];
                     const shortHolding = portfolio.holdings[pair.shortStock];
                     if (!longHolding || !shortHolding) return null;

                     return (
                         <div key={pair.id} className="bg-gray-100 dark:bg-gray-900/30 p-2 rounded-lg">
                            <h4 className="font-bold text-center text-amber-600 dark:text-amber-300 mb-2">{stocks[pair.longStock].koreanName} / {stocks[pair.shortStock].koreanName}</h4>
                            {renderPosition(stocks[pair.longStock], PositionType.LONG, longHolding.shares, longHolding.avgPrice, true)}
                            {renderPosition(stocks[pair.shortStock], PositionType.SHORT, shortHolding.shares, shortHolding.avgPrice, true)}
                         </div>
                     );
                 })}
            </div>

            {Object.keys(portfolio.holdings).filter(s => !portfolio.holdings[s as StockSymbol]?.pairSymbol).length === 0 && Object.keys(portfolio.pairTrades).length === 0 && (
                <p className="text-center text-gray-400 dark:text-gray-500 py-4">보유 포지션이 없습니다.</p>
            )}

        </div>
    );
};

export default PortfolioSummary;