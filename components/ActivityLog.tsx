
import React from 'react';
import { Activity, TradeAction, Currency } from '../types';

interface ActivityLogProps {
    activities: Activity[];
    isLoading: boolean;
}

const getActionStyles = (action: TradeAction): { bg: string, text: string, icon: React.ReactNode } => {
    switch (action) {
        case TradeAction.BUY:
            return { 
                bg: 'bg-green-500/10 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400', 
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
            };
        case TradeAction.SHORT:
            return { 
                bg: 'bg-red-500/10 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', 
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5.586l3.293-3.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-5-5a1 1 0 111.414-1.414L9 9.586V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            };
        case TradeAction.SELL:
             return { 
                bg: 'bg-pink-500/10 dark:bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', 
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
            };
        case TradeAction.COVER:
            return { 
                bg: 'bg-sky-500/10 dark:bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', 
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 17a1 1 0 01-1-1v-5.586l-3.293 3.293a1 1 0 11-1.414-1.414l5-5a1 1 0 011.414 0l5 5a1 1 0 11-1.414 1.414L11 10.414V16a1 1 0 01-1 1z" clipRule="evenodd" /></svg>
            };
        case TradeAction.ENTER_PAIR_TRADE:
        case TradeAction.EXIT_PAIR_TRADE:
             return { 
                bg: 'bg-amber-500/10 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', 
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" /></svg>
            };
        case TradeAction.HOLD:
        default:
            return { 
                bg: 'bg-gray-500/10 dark:bg-gray-700/50', text: 'text-gray-500 dark:text-gray-400', 
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
            };
    }
};

const formatCurrency = (value: number, currency: Currency) => {
    const options = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: currency === Currency.USD ? 2 : 0,
        maximumFractionDigits: currency === Currency.USD ? 2 : 0,
    };
    return new Intl.NumberFormat(currency === Currency.USD ? 'en-US' : 'ko-KR', options).format(value);
};


const LoadingSkeleton: React.FC = () => (
    <div className="animate-pulse bg-gray-200 dark:bg-gray-700/50 p-3 rounded-md flex items-start space-x-3">
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600"></div>
        <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
        </div>
    </div>
);

const ActivityLog: React.FC<ActivityLogProps> = ({ activities, isLoading }) => {
    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4 flex flex-col flex-grow min-h-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2 flex-shrink-0">AI 활동 로그</h2>
            <div className="flex-grow overflow-y-auto space-y-3 pr-2">
                {isLoading && activities.length === 0 && <LoadingSkeleton />}
                {activities.map(activity => {
                    const styles = getActionStyles(activity.action);
                    const tradeInfo = activity.action !== TradeAction.HOLD && activity.action !== TradeAction.ENTER_PAIR_TRADE && activity.action !== TradeAction.EXIT_PAIR_TRADE
                        ? `${activity.shares}주 @ ${formatCurrency(activity.price, activity.stock.currency)}`
                        : '';
                    return (
                        <div key={activity.id} className={`${styles.bg} p-3 rounded-md flex items-start space-x-3`}>
                            <div className={`mt-1 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full ${styles.text}`}>
                                {styles.icon}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center">
                                    <p className={`font-bold text-sm ${styles.text}`}>
                                        {activity.stock.koreanName} {activity.action}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">{activity.timestamp}</p>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{activity.reason}</p>
                                {tradeInfo && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tradeInfo}</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ActivityLog;
