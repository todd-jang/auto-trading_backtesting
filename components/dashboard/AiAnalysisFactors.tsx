import React from 'react';
import { AnalysisFocus, HedgeFundStrategy, MlSignal } from '../../types';

interface AiAnalysisFactorsProps {
  analysis: AnalysisFocus | null;
  activeStrategy: HedgeFundStrategy;
  pairsSignal: string | null;
  mlSignal: MlSignal | null;
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

const MlAnalysisView: React.FC<{ mlSignal: MlSignal }> = ({ mlSignal }) => {
    const { action, confidence, predictedPriceChangePercent, featureImportance } = mlSignal;
    
    const actionColor = action === 'BUY' ? 'text-green-500 dark:text-green-400' : action === 'SELL' ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400';
    const confidenceColor = confidence > 0.8 ? 'bg-green-500' : confidence > 0.65 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-2 text-center">
                 <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400">ML Prediction</div>
                    <div className={`text-lg font-bold ${actionColor}`}>{action}</div>
                </div>
                 <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Predicted Change</div>
                    <div className={`text-lg font-bold ${predictedPriceChangePercent > 0 ? 'text-green-500' : 'text-red-500'}`}>{predictedPriceChangePercent.toFixed(2)}%</div>
                </div>
            </div>
            <div>
                 <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Confidence</span>
                    <span className="text-sm font-bold text-cyan-500 dark:text-cyan-400">{(confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div className={`h-4 rounded-full transition-all duration-500 ease-out ${confidenceColor}`} style={{ width: `${confidence * 100}%` }}></div>
                </div>
            </div>
            <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 text-center">Feature Importance</h4>
                <div className="space-y-2">
                    {Object.entries(featureImportance).map(([name, value]) => (
                         <div key={name}>
                            <div className="flex justify-between items-center mb-1 text-xs">
                                <span className="font-medium text-gray-500 dark:text-gray-400">{name}</span>
                                <span>{(value * 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div className="bg-violet-500 h-2 rounded-full" style={{ width: `${value * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}


const AiAnalysisFactors: React.FC<AiAnalysisFactorsProps> = ({ analysis, activeStrategy, pairsSignal, mlSignal }) => {

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">AI 분석 모델</h2>
      <div className="space-y-4 h-full">
        {!analysis && (
             <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 dark:text-gray-500 text-center">백테스팅 시작 시<br/>분석을 개시합니다.</p>
             </div>
        )}
        {analysis && (
            <>
                <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">ANALYTICS TARGET</p>
                    <span className="font-bold text-lg text-amber-600 dark:text-amber-400">{analysis.stock.koreanName}</span>
                </div>

                {activeStrategy === HedgeFundStrategy.DEEP_HEDGING && mlSignal ? (
                   <MlAnalysisView mlSignal={mlSignal} />
                ) : (
                    <div className="animate-fade-in">
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Composite Alpha</div>
                                <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{analysis.factors.compositeAlphaScore.toFixed(1)}</div>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Pairs Arb Signal</div>
                                <div className="text-lg font-bold text-violet-600 dark:text-violet-400">{pairsSignal || '-'}</div>
                            </div>
                        </div>
                        <FactorBar label="Value" value={analysis.factors.value} color="text-sky-500" darkColor="dark:text-sky-400" />
                        <FactorBar label="Momentum" value={analysis.factors.momentum} color="text-emerald-500" darkColor="dark:text-emerald-400" />
                        <FactorBar label="Mean Reversion" value={analysis.factors.meanReversion} color="text-pink-500" darkColor="dark:text-pink-400" />
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};

export default AiAnalysisFactors;