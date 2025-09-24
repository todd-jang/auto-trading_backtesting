
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BacktestResult, Currency, Stock } from '../types';
import { useTheme } from './ThemeProvider';

interface BacktestResultsProps {
    results: BacktestResult;
}

const formatKrw = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const MetricCard: React.FC<{ label: string; value: string; note?: string, positive?: boolean, negative?: boolean }> = ({ label, value, note, positive, negative }) => {
    let valueColor = "text-cyan-600 dark:text-cyan-400";
    if (positive) valueColor = "text-green-600 dark:text-green-400";
    if (negative) valueColor = "text-red-600 dark:text-red-400";

    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${valueColor}`}>{value}</p>
            {note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{note}</p>}
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm p-3 rounded-lg border border-gray-300 dark:border-gray-600 shadow-xl">
                <p className="label text-sm font-semibold mb-1">{label}</p>
                <p className="text-cyan-500">{`Portfolio Value: ${formatKrw(payload[0].value)}`}</p>
            </div>
        );
    }
    return null;
};

const BacktestResults: React.FC<BacktestResultsProps> = ({ results }) => {
    const { theme } = useTheme();
    const { metrics, equityCurve, tradeLog } = results;

    const tickColor = theme === 'dark' ? '#A0AEC0' : '#4A5568';
    const gridColor = theme === 'dark' ? '#4A5568' : '#E2E8F0';
    
    const isTotalReturnPositive = metrics.totalReturn > 0;

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h3 className="text-xl font-semibold mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard label="Final Portfolio Value" value={formatKrw(metrics.finalValue)} note="KRW"/>
                    <MetricCard label="Total Return" value={formatPercent(metrics.totalReturn)} positive={isTotalReturnPositive} negative={!isTotalReturnPositive} />
                    <MetricCard label="Sharpe Ratio" value={metrics.sharpeRatio.toFixed(3)} note="Annualized"/>
                    <MetricCard label="Max Drawdown" value={formatPercent(metrics.maxDrawdown)} negative={true} />
                    <MetricCard label="Total Trades" value={metrics.totalTrades.toString()} />
                    <MetricCard label="Win Rate" value={formatPercent(metrics.winRate)} />
                </div>
            </div>

            <div>
                <h3 className="text-xl font-semibold mb-4">Equity Curve</h3>
                <div className="h-80 w-full bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                    <ResponsiveContainer width="100%" height="100%">
                         <LineChart data={equityCurve} margin={{ top: 5, right: 20, left: 25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="time" stroke={tickColor} fontSize={12} tick={{ fill: tickColor }} />
                            <YAxis 
                                stroke={tickColor} fontSize={12} 
                                tickFormatter={(val) => `₩${(val/1000000).toFixed(0)}M`}
                                tick={{ fill: tickColor }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey="value" name="Portfolio Value" stroke="#0891B2" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div>
                <h3 className="text-xl font-semibold mb-4">Trade Log</h3>
                <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                            <tr>
                                <th scope="col" className="px-4 py-3">Timestamp</th>
                                <th scope="col" className="px-4 py-3">Stock</th>
                                <th scope="col" className="px-4 py-3">Action</th>
                                <th scope="col" className="px-4 py-3">Shares</th>
                                <th scope="col" className="px-4 py-3">Price</th>
                                <th scope="col" className="px-4 py-3">P&L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tradeLog.map(trade => (
                                <tr key={trade.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                    <td className="px-4 py-2">{trade.timestamp}</td>
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{trade.stock.koreanName}</td>
                                    <td className={`px-4 py-2 font-semibold ${trade.action === 'BUY' || trade.action === 'COVER' ? 'text-green-500' : 'text-red-500'}`}>{trade.action}</td>
                                    <td className="px-4 py-2">{trade.shares}</td>
                                    <td className="px-4 py-2">{trade.price.toLocaleString()}</td>
                                    <td className={`px-4 py-2 font-mono ${trade.pnl && trade.pnl > 0 ? 'text-green-500' : trade.pnl && trade.pnl < 0 ? 'text-red-500' : ''}`}>
                                        {trade.pnl ? formatKrw(trade.pnl) : '---'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BacktestResults;
