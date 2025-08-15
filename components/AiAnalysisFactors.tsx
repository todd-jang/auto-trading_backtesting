
import React from 'react';
import { AnalysisFocus, Trend, Currency, HedgeFundStrategy } from '../types';

interface AiAnalysisFactorsProps {
  analysis: AnalysisFocus | null;
  activeStrategy: HedgeFundStrategy;
  pairsSignal: string | null;
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


const AiAnalysisFactors: React.FC<AiAnalysisFactorsProps> = ({ analysis, activeStrategy, pairsSignal }) => {

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">AI 분석 모델</h2>
      <div className="space-y-4 h-full">
        {analysis ? (
          <>
            <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">ANALYTICS TARGET</p>
                <span className="font-bold text-lg text-amber-600 dark:text-amber-400">{analysis.stock.koreanName}</span>
            </div>
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
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 dark:text-gray-500 text-center">백테스팅 시작 시<br/>분석을 개시합니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiAnalysisFactors;