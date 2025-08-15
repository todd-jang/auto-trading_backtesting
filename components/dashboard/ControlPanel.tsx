import React from 'react';
import { MarketRegime, HedgeFundStrategy } from '../../types';

interface ControlPanelProps {
    isEngineRunning: boolean;
    onToggleEngine: () => void;
    isAggressiveMode: boolean;
    onToggleAggressiveMode: () => void;
    isLowLatencyMode: boolean;
    onToggleLowLatencyMode: () => void;
    liveTime: Date;
    marketRegime: MarketRegime;
    activeStrategy: HedgeFundStrategy;
    strategyReason: string;
    marketStatuses: { [market: string]: 'OPEN' | 'CLOSED' };
}

const MarketStatusIndicator: React.FC<{ market: string, status: 'OPEN' | 'CLOSED' }> = ({ market, status }) => {
    const isOpen = status === 'OPEN';
    return (
        <div className="flex items-center justify-center">
            <span className="relative flex h-2 w-2 mr-1.5">
                {isOpen && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">{market}:</span>
            <span className={`text-xs font-bold ${isOpen ? 'text-green-500' : 'text-red-500'}`}>{status}</span>
        </div>
    )
}

const ControlPanel: React.FC<ControlPanelProps> = ({ isEngineRunning, onToggleEngine, isAggressiveMode, onToggleAggressiveMode, isLowLatencyMode, onToggleLowLatencyMode, liveTime, marketRegime, activeStrategy, strategyReason, marketStatuses }) => {

    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-center flex-1">
                     <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center">
                            <span className="relative flex h-2 w-2 mr-1.5">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isEngineRunning ? 'bg-green-400' : 'bg-red-400'}`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${isEngineRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            </span>
                            시스템 시간
                        </div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{liveTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false})}</div>
                    </div>
                    <MarketStatusIndicator market="KOREA" status={marketStatuses.KOREA} />
                    <MarketStatusIndicator market="USA" status={marketStatuses.USA} />
                     <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">MARKET REGIME</div>
                        <div className="text-sm font-bold text-amber-500 dark:text-amber-400">{marketRegime}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">ACTIVE STRATEGY</div>
                        <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{activeStrategy}</div>
                    </div>
                </div>

                <div className="flex items-center justify-center sm:justify-end gap-4">
                     <div className="flex flex-col items-center">
                        <label htmlFor="aggressive-toggle" className="flex items-center cursor-pointer">
                            <span className="mr-3 text-sm font-medium text-gray-700 dark:text-gray-300">적극 투자</span>
                            <div className="relative">
                                <input type="checkbox" id="aggressive-toggle" className="sr-only" checked={isAggressiveMode} onChange={onToggleAggressiveMode} />
                                <div className={`block w-14 h-8 rounded-full transition ${isAggressiveMode ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isAggressiveMode ? 'transform translate-x-6' : ''}`}></div>
                            </div>
                        </label>
                         <div className={`text-xs mt-1 font-bold ${isAggressiveMode ? 'text-amber-500' : 'text-gray-500'}`}>
                             {isAggressiveMode ? 'ON' : 'OFF'}
                         </div>
                    </div>
                     <div className="flex flex-col items-center">
                        <label htmlFor="low-latency-toggle" className="flex items-center cursor-pointer">
                            <span className="mr-3 text-sm font-medium text-gray-700 dark:text-gray-300">저지연 모드</span>
                            <div className="relative">
                                <input type="checkbox" id="low-latency-toggle" className="sr-only" checked={isLowLatencyMode} onChange={onToggleLowLatencyMode} />
                                <div className={`block w-14 h-8 rounded-full transition ${isLowLatencyMode ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isLowLatencyMode ? 'transform translate-x-6' : ''}`}></div>
                            </div>
                        </label>
                         <div className={`text-xs mt-1 font-bold ${isLowLatencyMode ? 'text-blue-500' : 'text-gray-500'}`}>
                             {isLowLatencyMode ? 'ON' : 'OFF'}
                         </div>
                    </div>
                     <div className="flex flex-col items-center">
                        <label htmlFor="engine-toggle" className="flex items-center cursor-pointer">
                            <span className="mr-3 text-sm font-medium text-gray-700 dark:text-gray-300">AutoTrade</span>
                            <div className="relative">
                                <input type="checkbox" id="engine-toggle" className="sr-only" checked={isEngineRunning} onChange={onToggleEngine} />
                                <div className={`block w-14 h-8 rounded-full transition ${isEngineRunning ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isEngineRunning ? 'transform translate-x-6' : ''}`}></div>
                            </div>
                        </label>
                         <div className={`text-xs mt-1 font-bold ${isEngineRunning ? 'text-green-500' : 'text-red-500'}`}>
                             {isEngineRunning ? 'ACTIVE' : 'INACTIVE'}
                         </div>
                    </div>
                </div>
            </div>
            {isEngineRunning && strategyReason && (
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