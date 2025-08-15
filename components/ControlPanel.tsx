
import React from 'react';
import { MarketRegime, HedgeFundStrategy } from '../types';

interface ControlPanelProps {
    isRunning: boolean;
    isLoading: boolean;
    onToggleSimulation: () => void;
    currentDate: string;
    marketRegime: MarketRegime;
    activeStrategy: HedgeFundStrategy;
    strategyReason: string;
}

const StartIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
);

const StopIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
    </svg>
);

const ControlPanel: React.FC<ControlPanelProps> = ({ isRunning, isLoading, onToggleSimulation, currentDate, marketRegime, activeStrategy, strategyReason }) => {

    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center flex-1">
                     <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">BACKTEST DATE</div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{currentDate}</div>
                    </div>
                     <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">MARKET REGIME</div>
                        <div className="text-sm font-bold text-amber-500 dark:text-amber-400">{marketRegime}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">ACTIVE STRATEGY</div>
                        <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{activeStrategy}</div>
                    </div>
                </div>

                <button
                    onClick={onToggleSimulation}
                    disabled={isLoading}
                    className={`flex items-center justify-center w-full sm:w-auto px-6 py-3 text-base font-bold text-white rounded-lg shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 ${
                        isRunning ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                    } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                >
                    {isRunning ? <StopIcon /> : <StartIcon />}
                    {isLoading ? 'AI 분석중...' : (isRunning ? '백테스팅 중지' : '백테스팅 시작')}
                </button>
            </div>
            {isRunning && strategyReason && (
                <div className="text-center bg-gray-100 dark:bg-gray-900/50 p-2 rounded-md border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-bold text-cyan-600 dark:text-cyan-400">CIO's Note:</span> {strategyReason}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ControlPanel;