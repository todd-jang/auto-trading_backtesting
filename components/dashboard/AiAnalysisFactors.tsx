import React from 'react';
import { AnalysisFocus, HedgeFundStrategy, AITradeSignal, Trend, TradeAction } from '../../types';

interface AiAnalysisFactorsProps {
  analysis: AnalysisFocus | null;
  activeStrategy: HedgeFundStrategy;
  pairsSignal: string | null;
  mlSignal: AITradeSignal | null;
  analystSignal: AITradeSignal | null;
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

const JocodingMAView: React.FC<{ analysis: AnalysisFocus }> = ({ analysis }) => {
    const { shortMA, longMA } = analysis;
    if (shortMA === undefined || longMA === undefined) {
        return <p className="text-center text-gray-400">Calculating MAs...</p>;
    }

    const isGolden = shortMA > longMA;
    const diff = Math.abs(shortMA - longMA);
    const diffPercent = longMA > 0 ? (diff / longMA) * 100 : 0;
    
    let statusText = '교차점 모니터링';
    let statusColor = 'text-gray-500 dark:text-gray-400';
    if(diffPercent < 0.2) {
        statusText = '교차 임박!';
        statusColor = 'text-amber-500 dark:text-amber-400';
    } else if (isGolden) {
        statusText = '강세 (골든 크로스)';
        statusColor = 'text-green-500 dark:text-green-400';
    } else {
        statusText = '약세 (데드 크로스)';
        statusColor = 'text-red-500 dark:text-red-400';
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="text-center p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">이동평균선 상태</h4>
                <p className={`text-lg font-bold ${statusColor}`}>{statusText}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg text-center border-2 ${isGolden ? 'border-green-500 bg-green-500/10' : 'border-gray-300 dark:border-gray-600'}`}>
                    <div className="text-xs text-gray-500 dark:text-gray-400">5일 단기 MA</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{shortMA.toFixed(2)}</div>
                </div>
                 <div className={`p-3 rounded-lg text-center border-2 ${!isGolden ? 'border-red-500 bg-red-500/10' : 'border-gray-300 dark:border-gray-600'}`}>
                    <div className="text-xs text-gray-500 dark:text-gray-400">20일 장기 MA</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{longMA.toFixed(2)}</div>
                </div>
            </div>
        </div>
    );
};

const AnalystJudgement: React.FC<{ signal: AITradeSignal }> = ({ signal }) => {
    const { decision, reason, confidence } = signal;

    const decisionStyles = {
        [TradeAction.BUY]: { text: '매수', color: 'text-green-500 dark:text-green-400', bg: 'bg-green-500' },
        [TradeAction.SELL]: { text: '매도', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500' },
        [TradeAction.SHORT]: { text: '공매도', color: 'text-red-600 dark:text-red-500', bg: 'bg-red-600' },
        [TradeAction.COVER]: { text: '커버', color: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-500' },
        [TradeAction.HOLD]: { text: '보류', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-500' },
    };
    const style = decisionStyles[decision] || decisionStyles[TradeAction.HOLD];

    return (
        <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400">최종 결정</div>
                    <div className={`text-lg font-bold ${style.color}`}>{style.text}</div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400">신뢰도</div>
                    <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{(confidence * 100).toFixed(1)}%</div>
                </div>
            </div>
            <div>
                 <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className={`bg-cyan-500 h-2.5 rounded-full`} style={{ width: `${confidence * 100}%` }}></div>
                </div>
            </div>
             <div className="bg-gray-100 dark:bg-gray-900/50 p-3 rounded-md border-l-4 border-gray-300 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">핵심 사유:</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{reason}</p>
            </div>
        </div>
    );
};

const AiAnalysisFactors: React.FC<AiAnalysisFactorsProps> = ({ analysis, activeStrategy, pairsSignal, mlSignal, analystSignal }) => {

  const isGeneralAnalysis = (activeStrategy === HedgeFundStrategy.ALPHA_MOMENTUM || activeStrategy === HedgeFundStrategy.MEAN_REVERSION);
  
  if (activeStrategy === HedgeFundStrategy.RISK_OFF) {
    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">AI 분석 모델</h2>
          <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg animate-fade-in flex flex-col justify-center min-h-[200px]">
              <h4 className="text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-2">전략: 리스크 오프 (현금 보유)</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                  AI CIO가 시장 변동성이 높다고 판단하여, 신규 포지션 진입을 중단하고 현금 보유를 권고합니다.
              </p>
          </div>
        </div>
    );
  }

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

                {activeStrategy === HedgeFundStrategy.JOCODING_MA_CROSS ? (
                    <JocodingMAView analysis={analysis} />
                ) : activeStrategy === HedgeFundStrategy.PAIRS_TRADING ? (
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

                        {isGeneralAnalysis && (
                            <div className="border-t-2 border-dashed border-gray-200 dark:border-gray-600 pt-3 mt-3">
                                <h4 className="text-sm font-semibold text-center text-gray-500 dark:text-gray-400 mb-2">AI 최종 판단</h4>
                                {!analystSignal ? (
                                    <div className="flex items-center justify-center p-4 text-gray-500 dark:text-gray-400">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>분석 중...</span>
                                    </div>
                                ) : (
                                    <AnalystJudgement signal={analystSignal} />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};

export default AiAnalysisFactors;