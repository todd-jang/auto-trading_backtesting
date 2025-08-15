
import React from 'react';
import { CandlestickDataPoint, StockSymbol, Activity } from '../types';
import { STOCKS } from '../constants';
import CandlestickChart from './CandlestickChart';

interface IndividualChartsProps {
    allChartData: { [key in StockSymbol]?: CandlestickDataPoint[] };
    activities: Activity[];
}

const IndividualCharts: React.FC<IndividualChartsProps> = ({ allChartData, activities }) => {
    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">개별 종목 상세 차트 (AI 매매 시점)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Object.values(STOCKS).map(stock => {
                    const chartData = allChartData[stock.symbol];
                    if (!chartData || chartData.length === 0) {
                        return <div key={stock.symbol} className="h-80 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg"><p className="text-gray-400">Loading {stock.koreanName}...</p></div>;
                    }
                    return (
                        <CandlestickChart 
                            key={stock.symbol}
                            stock={stock}
                            data={chartData}
                            activities={activities}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default IndividualCharts;
