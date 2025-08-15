import React from 'react';
import { AnalysisFocus, HedgeFundStrategy, AITradeSignal, Trend, TradeAction } from '../../types';

interface AiAnalysisFactorsProps {
  analysis: AnalysisFocus | null;
  activeStrategy: HedgeFundStrategy;
  pairsSignal: string | null;
  mlSignal: AITradeSignal | null;
}

const FactorBar: React.FC<{ label: string, value: number, color: string, darkColor: string }> = ({ label, value, color, darkColor }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</span>
            <span className={`text-sm font-bold ${color} ${darkColor}`}>{value.toFixed(1)} / 100</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full transition-all duration-500 ease-out ${color.replace('text-', 'bg-')} ${darkColor.replace('text-', 'dark:bg-')}`} style={{ width: `${value}%` }}></div>
        </div>
    </div>
);

const FundamentalStat: React.FC<{ label: string, value: string | number, bigger?: boolean }> = ({ label, value, bigger = false }) => (
    <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg text-center">
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className={`font-bold ${bigger ? 'text-lg' : 'text-md'} text-gray-800 dark:text-gray-100`}>{value}</div>
    </div>
);

const TrendIndicator: React.FC<{ trend: Trend }> = ({ trend }) => {
    const trendStyles = {
        UPTREND: { text: '상승추세', color: 'text-green-500 dark:text-green-400', icon: '▲' },
        DOWNTREND: { text: '하락추세', color: 'text-red-500 dark:text-red-400', icon: '▼' },
        NEUTRAL: { text: '중립/횡보', color: 'text-gray-500 dark:text-gray-400', icon: '―' },
    };
    const style = trendStyles[trend];
    return (
        <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">시장 컨텍스트</div>
            <div className={`text-md font-bold ${style.color}`}>{style.icon} {style.text}</div>
        </div>
    );
};


const MlAnalysisView: React.FC<{ mlSignal: AITradeSignal }> = ({ mlSignal }) => {
    const { decision, reason, softmaxProbabilities } = mlSignal;
    
    const actionColor = decision === TradeAction.BUY ? 'text-green-500 dark:text-green-400' : decision === TradeAction.SELL ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400';

    const SoftmaxBar: React.FC<{label: string, probability: number, colorClass: string}> = ({ label, probability, colorClass }) => (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className={`text-sm font-medium ${colorClass}`}>{label}</span>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{(probability * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 relative">
                <div className={`h-4 rounded-full transition-all duration-500 ease-out ${colorClass.replace('text-', 'bg-')}`} style={{ width: `${probability * 100}%` }}></div>
                {/* Threshold line */}
                <div className="absolute top-0 bottom-0 border-r-2 border-dashed border-gray-400 dark:border-gray-500" style={{ left: '70%' }}></div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-2 text-center">
                 <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Final Decision</div>
                    <div className={`text-lg font-bold ${actionColor}`}>{decision}</div>
                </div>
                 <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg col-span-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Inference Rationale</div>
                    <div className="text-sm text-gray-800 dark:text-gray-100 mt-1">{reason}</div>
                </div>
            </div>

            {softmaxProbabilities && (
                <div>
                    <h4 className="text-sm font-semibold text-center text-gray-500 dark:text-gray-400 mb-2">Softmax Probabilities (Threshold: 70%)</h4>
                    <div className="space-y-3">
                        <SoftmaxBar label="BUY" probability={softmaxProbabilities.buy} colorClass="text-green-500" />
                        <SoftmaxBar label="SELL" probability={softmaxProbabilities.sell} colorClass="text-red-500" />
                        <SoftmaxBar label="HOLD" probability={softmaxProbabilities.hold} colorClass="text-gray-500" />
                    </div>
                </div>
            )}
        </div>
    );
};


const AiAnalysisFactors: React.FC<AiAnalysisFactorsProps> = ({ analysis, activeStrategy, pairsSignal, mlSignal }) => {

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">AI 분석 모델</h2>
      <div className="space-y-4 h-full">
        {!analysis && (
             <div className="flex items-center justify-center h-full min-h-[200px]">
                <p className="text-gray-400 dark:text-gray-500 text-center">엔진 활성화 시<br/>분석을 개시합니다.</p>
             </div>
        )}
        {analysis && (
            <>
                <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">ANALYTICS TARGET</p>
                    <span className="font-bold text-lg text-amber-600 dark:text-amber-400">{analysis.stock.koreanName}</span>
                </div>

                {activeStrategy === HedgeFundStrategy.PAIRS_TRADING ? (
                    <div className="text-center p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-fade-in flex flex-col justify-center min-h-[150px]">
                        <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Statistical Arbitrage Signal</h4>
                        <p className="text-md text-amber-600 dark:text-amber-400 font-medium">{pairsSignal || 'Awaiting signal...'}</p>
                    </div>
                ) : activeStrategy === HedgeFundStrategy.DEEP_HEDGING && mlSignal ? (
                   <MlAnalysisView mlSignal={mlSignal} />
                ) : (
                    <div className="space-y-4 animate-fade-in">
                         <TrendIndicator trend={analysis.trend} />
                         <div>
                            <h4 className="text-sm font-semibold text-center text-gray-500 dark:text-gray-400 mb-2">펀더멘털 건전성</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <FundamentalStat label="P/E Ratio" value={analysis.fundamentals.peRatio.toFixed(1)} />
                                <FundamentalStat label="EPS Growth" value={`${analysis.fundamentals.epsGrowth.toFixed(1)}%`} />
                                <FundamentalStat label="Debt/Equity" value={analysis.fundamentals.debtToEquity.toFixed(2)} />
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-center text-gray-500 dark:text-gray-400 mb-2">퀀트 알파 팩터</h4>
                             <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg text-center mb-3">
                                <div className="text-xs text-gray-500 dark:text-gray-400">종합 알파 점수</div>
                                <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{analysis.factors.compositeAlphaScore.toFixed(1)}</div>
                            </div>
                            <div className="space-y-2">
                                <FactorBar label="Value" value={analysis.factors.value} color="text-sky-500" darkColor="dark:text-sky-400" />
                                <FactorBar label="Momentum" value={analysis.factors.momentum} color="text-emerald-500" darkColor="dark:text-emerald-400" />
                                <FactorBar label="Mean Reversion" value={analysis.factors.meanReversion} color="text-pink-500" darkColor="dark:text-pink-400" />
                            </div>
                        </div>
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};

export default AiAnalysisFactors;