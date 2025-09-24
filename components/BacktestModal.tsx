
import React, { useState, useCallback } from 'react';
import { HedgeFundStrategy, BacktestResult } from '../types';
import BacktestResults from './BacktestResults';

interface BacktestModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const BacktestModal: React.FC<BacktestModalProps> = ({ isOpen, onClose }) => {
    const [strategy, setStrategy] = useState<HedgeFundStrategy>(HedgeFundStrategy.ALPHA_MOMENTUM);
    const [initialCapital, setInitialCapital] = useState<number>(100_000_000);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<BacktestResult | null>(null);
    
    const handleRunBacktest = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setResults(null);

        try {
            const response = await fetch('/api/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    strategy,
                    initialCapital,
                 }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Backtest failed on the server.');
            }

            const backtestResult: BacktestResult = await response.json();
            setResults(backtestResult);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [strategy, initialCapital]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Strategy Backtester</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                
                <div className="flex flex-col md:flex-row flex-grow min-h-0">
                    {/* Control Panel */}
                    <aside className="w-full md:w-72 p-4 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-6">
                        <h3 className="font-semibold text-lg">Configuration</h3>
                        <div>
                            <label htmlFor="strategy" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Trading Strategy</label>
                            <select 
                                id="strategy" 
                                value={strategy} 
                                onChange={e => setStrategy(e.target.value as HedgeFundStrategy)}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md"
                            >
                                {Object.values(HedgeFundStrategy).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="initial-capital" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Initial Capital (KRW)</label>
                            <input 
                                type="number" 
                                id="initial-capital"
                                value={initialCapital}
                                onChange={e => setInitialCapital(Number(e.target.value))}
                                step={10_000_000}
                                className="mt-1 block w-full pl-3 py-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500"
                            />
                        </div>
                        <button 
                            onClick={handleRunBacktest}
                            disabled={isLoading}
                            className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                        >
                            {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            {isLoading ? 'Running Simulation...' : 'Run Backtest'}
                        </button>
                    </aside>
                    
                    {/* Results Area */}
                    <main className="flex-grow p-6 overflow-y-auto">
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="text-cyan-500 text-4xl mb-4">⚙️</div>
                                <h3 className="text-xl font-semibold">Running backtest...</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-2">Simulating trades and calling AI models. This may take a moment.</p>
                            </div>
                        )}
                        {error && (
                            <div className="flex flex-col items-center justify-center h-full text-center text-red-500 bg-red-500/10 p-4 rounded-lg">
                                 <div className="text-4xl mb-4">⚠️</div>
                                <h3 className="text-xl font-semibold">An Error Occurred</h3>
                                <p className="mt-2">{error}</p>
                            </div>
                        )}
                        {results && <BacktestResults results={results} />}
                        {!isLoading && !error && !results && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="text-gray-400 dark:text-gray-500 text-4xl mb-4">📊</div>
                                <h3 className="text-xl font-semibold">Ready to run backtest</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-2">Configure your settings on the left and click "Run Backtest" to see strategy performance on historical data.</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default BacktestModal;
