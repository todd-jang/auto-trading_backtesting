
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { CandlestickDataPoint, Stock, Activity, TradeAction, Currency, StockSymbol } from '../types';
import { useTheme } from './ThemeProvider';

interface CandlestickChartProps {
    stock: Stock;
    data: CandlestickDataPoint[];
    activities: Activity[];
}

const CustomCandle = (props: any) => {
    const { x, y, width, height, low, high, open, close } = props;
    const { theme } = useTheme();
    const isUp = close >= open;
    const color = isUp ? (theme === 'dark' ? '#22c55e' : '#16a34a') : (theme === 'dark' ? '#ef4444' : '#dc2626');

    const wickX = x + width / 2;
    const bodyY = isUp ? y + (high - close) / (high - low) * height : y + (high - open) / (high - low) * height;
    const bodyHeight = Math.abs(open - close) / (high - low) * height;

    return (
        <g>
            <line x1={wickX} y1={y} x2={wickX} y2={y + height} stroke={color} />
            <rect x={x} y={bodyY} width={width} height={bodyHeight} fill={color} />
        </g>
    );
};

const formatCurrency = (value: number, currency: Currency) => {
    const options = { style: 'currency', currency, minimumFractionDigits: currency === Currency.USD ? 2 : 0, maximumFractionDigits: currency === Currency.USD ? 2 : 0, };
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'ko-KR', options).format(value);
};

const TradeMarker = (props: any) => {
    const { theme } = useTheme();
    const { cx, cy, payload, action } = props;

    let color, points, finalY;
    const markerOffset = 10;

    if (action === TradeAction.BUY || action === TradeAction.COVER) {
        color = theme === 'dark' ? '#22c55e' : '#16a34a';
        finalY = cy + markerOffset;
        points = `${cx},${finalY - 5} ${cx - 5},${finalY + 5} ${cx + 5},${finalY + 5}`; // Up arrow below candle
    } else { // SELL or SHORT
        color = theme === 'dark' ? '#ef4444' : '#dc2626';
        finalY = cy - markerOffset;
        points = `${cx},${finalY + 5} ${cx - 5},${finalY - 5} ${cx + 5},${finalY - 5}`; // Down arrow above candle
    }
    
    return <polygon points={points} fill={color} />;
};

const CandlestickChart: React.FC<CandlestickChartProps> = ({ stock, data, activities }) => {
    const { theme } = useTheme();
    const tickColor = theme === 'dark' ? '#A0AEC0' : '#4A5568';
    const gridColor = theme === 'dark' ? '#2D3748' : '#E2E8F0';

    const chartData = data.map(d => ({
        ...d,
        candle: [d.low, d.high]
    }));
    
    const tradeActivities = activities.filter(a => a.stock.symbol === stock.symbol && (a.action === TradeAction.BUY || a.action === TradeAction.SELL || a.action === TradeAction.SHORT || a.action === TradeAction.COVER));
    
    const renderTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm p-3 rounded-lg border border-gray-300 dark:border-gray-600 shadow-xl text-xs">
                    <p className="font-bold text-gray-800 dark:text-gray-100">{label}</p>
                    <div className="grid grid-cols-2 gap-x-2 mt-1">
                        <span>Open:</span><span className="text-right font-mono">{formatCurrency(data.open, stock.currency)}</span>
                        <span>High:</span><span className="text-right font-mono">{formatCurrency(data.high, stock.currency)}</span>
                        <span>Low:</span><span className="text-right font-mono">{formatCurrency(data.low, stock.currency)}</span>
                        <span>Close:</span><span className="text-right font-mono font-bold">{formatCurrency(data.close, stock.currency)}</span>
                    </div>
                </div>
            );
        }
        return null;
    };


    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4 h-80 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">{stock.koreanName} ({stock.symbol})</h3>
            <div className="flex-grow mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="time" stroke={tickColor} fontSize={10} tick={{ fill: tickColor }} />
                        <YAxis stroke={tickColor} fontSize={10} tick={{ fill: tickColor }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(val) => typeof val === 'number' ? val.toLocaleString() : val} allowDataOverflow={true} />
                        <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(128,128,128,0.1)' }}/>
                        <Bar dataKey="candle" shape={<CustomCandle />} />

                        {tradeActivities.map(activity => {
                            const dataPoint = chartData.find(d => d.time === activity.time);
                            if (!dataPoint) return null;
                            
                            const yPosition = (activity.action === TradeAction.BUY || activity.action === TradeAction.COVER)
                                ? dataPoint.low
                                : dataPoint.high;

                            return (
                                <ReferenceDot
                                    key={activity.id}
                                    x={activity.time}
                                    y={yPosition}
                                    r={10}
                                    ifOverflow="extendDomain"
                                    shape={<TradeMarker action={activity.action} />}
                                />
                            );
                        })}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default CandlestickChart;