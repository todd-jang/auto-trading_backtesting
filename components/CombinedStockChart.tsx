
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { NormalizedChartDataPoint, StockSymbol, Currency, Activity, TradeAction } from '../types';
import { STOCKS, STOCK_COLORS } from '../constants';
import { useTheme } from './ThemeProvider';

interface CombinedStockChartProps {
    data: NormalizedChartDataPoint[];
    activities: Activity[];
}

const formatCurrency = (value: number, currency: Currency) => {
    const options = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: currency === Currency.USD ? 2 : 0,
        maximumFractionDigits: currency === Currency.USD ? 2 : 0,
    };
    return new Intl.NumberFormat(currency === Currency.USD ? 'en-US' : 'ko-KR', options).format(value);
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm p-3 rounded-lg border border-gray-300 dark:border-gray-600 shadow-xl">
                <p className="label text-sm text-gray-600 dark:text-gray-300 font-semibold mb-2">{`Time: ${label}`}</p>
                {payload.map((pld: any) => {
                    const stockSymbol = pld.dataKey as StockSymbol;
                    const stock = STOCKS[stockSymbol];
                    if (!stock) return null;
                    
                    const originalPrice = pld.payload[`${stockSymbol}_price`];
                    
                    return (
                        <div key={pld.dataKey} className="flex justify-between items-center text-sm mt-1">
                            <span style={{ color: pld.stroke }}>{stock.koreanName}:</span>
                            <span className="font-mono ml-4" style={{ color: pld.stroke }}>
                                {`${formatCurrency(originalPrice, stock.currency)} (${pld.value.toFixed(2)})`}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
};

const TradeMarker = (props: any) => {
    const { theme } = useTheme();
    const { cx, cy, action } = props;

    let color;
    if (action === TradeAction.BUY) {
        color = theme === 'dark' ? '#22c55e' : '#16a34a'; // green-500 / green-600
    } else { // SELL
        color = theme === 'dark' ? '#ef4444' : '#dc2626'; // red-500 / red-600
    }
    
    const points = action === TradeAction.BUY
        ? `${cx},${cy - 6} ${cx - 6},${cy + 4} ${cx + 6},${cy + 4}` 
        : `${cx},${cy + 6} ${cx - 6},${cy - 4} ${cx + 6},${cy - 4}`;

    return <polygon points={points} fill={color} stroke={color} strokeWidth="1" />;
};


const CombinedStockChart: React.FC<CombinedStockChartProps> = ({ data, activities }) => {
    const { theme } = useTheme();
    const formatYAxis = (tickItem: number) => `${tickItem.toFixed(0)}`;
    
    const tickColor = theme === 'dark' ? '#A0AEC0' : '#4A5568';
    const gridColor = theme === 'dark' ? '#4A5568' : '#E2E8F0';
    const legendColor = theme === 'dark' ? '#E5E7EB' : '#1F2937';

    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4 pt-6 h-80 sm:h-96 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">글로벌 주가 수익률 비교 (초기 시점 기준 100)</h3>
            <div className="flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{ top: 5, right: 20, left: -5, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="time" stroke={tickColor} fontSize={12} tick={{ fill: tickColor }} interval="preserveStartEnd" />
                        <YAxis 
                            stroke={tickColor} 
                            fontSize={12} 
                            tickFormatter={formatYAxis} 
                            domain={['auto', 'auto']}
                            tick={{ fill: tickColor }}
                            label={{ value: '수익률', angle: -90, position: 'insideLeft', fill: tickColor, dx: -5, dy: 30 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: legendColor, paddingTop: '10px' }} />
                        {Object.values(STOCKS).map(stock => (
                            <Line 
                                key={stock.symbol}
                                type="monotone" 
                                dataKey={stock.symbol} 
                                name={stock.koreanName} 
                                stroke={STOCK_COLORS[stock.symbol]} 
                                strokeWidth={2} 
                                dot={false} 
                            />
                        ))}
                        {/* Render trade markers */}
                        {activities
                            .filter(act => act.action === TradeAction.BUY || act.action === TradeAction.SELL)
                            .map(activity => {
                                // Find the corresponding data point to get the Y value
                                const dataPoint = data.find(d => d.time === activity.time);
                                if (!dataPoint) return null;
                                const yValue = dataPoint[activity.stock.symbol];

                                return (
                                    <ReferenceDot 
                                        key={activity.id} 
                                        x={activity.time} 
                                        y={yValue as number}
                                        r={8} 
                                        shape={<TradeMarker action={activity.action} />}
                                        ifOverflow="extendDomain"
                                    />
                                );
                        })}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default CombinedStockChart;
