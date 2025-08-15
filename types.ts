export enum StockSymbol {
  SAMSUNG = '005930',
  HYNIX = '000660',
  NVIDIA = 'NVDA',
  TSMC = 'TSM',
  MICRON = 'MU'
}

export enum Currency {
    KRW = 'KRW',
    USD = 'USD'
}

export enum TradeAction {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
  SHORT = 'SHORT',
  COVER = 'COVER',
  ENTER_PAIR_TRADE = 'ENTER_PAIR_TRADE',
  EXIT_PAIR_TRADE = 'EXIT_PAIR_TRADE',
}

export enum PositionType {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

export enum HedgeFundStrategy {
  ALPHA_MOMENTUM = 'Alpha Momentum',
  PAIRS_TRADING = 'Pairs Trading (Stat Arb)',
  MEAN_REVERSION = 'Mean Reversion',
  RISK_OFF = 'Risk Off (Hold)',
  DEEP_HEDGING = 'Deep Hedging (ML)',
}

export enum MarketRegime {
    TRENDING = 'Trending Market', // Strong directional moves
    RANGING = 'Ranging Market', // Sideways, volatile
    NEUTRAL = 'Neutral Market', // Calm, non-directional
    LOW_VOLATILITY = 'Low Volatility', // Very calm
}

export type TradingSignal = 'STRONG_BUY' | 'STRONG_SELL' | null;

export type Trend = 'UPTREND' | 'DOWNTREND' | 'NEUTRAL';

export interface Stock {
  symbol: StockSymbol;
  name: string;
  koreanName: string;
  currency: Currency;
}

export interface ChartDataPoint {
  time: string;
  price: number;
}

export interface CandlestickDataPoint {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface NormalizedChartDataPoint {
  time: string;
  [key: string]: number | string; 
}

export interface AlphaFactors {
  value: number; 
  momentum: number;
  meanReversion: number; 
  compositeAlphaScore: number;
}

export interface Activity {
  id: string;
  timestamp: string;
  action: TradeAction;
  stock: Stock;
  price: number;
  shares: number;
  reason: string;
  time: string;
}

export interface PortfolioHolding {
    shares: number;
    avgPrice: number;
    positionType: PositionType;
    pairSymbol?: StockSymbol; // Indicates this holding is part of a pair trade
}

export interface PairTrade {
  id: string;
  longStock: StockSymbol;
  shortStock: StockSymbol;
  shares: number;
  entryPriceLong: number;
  entryPriceShort: number;
  entrySpread: number;
  entryTime: string;
}

export interface Portfolio {
  cash: number; // Always in KRW
  holdings: {
    [key in StockSymbol]?: PortfolioHolding
  };
  pairTrades: {
    [key: string]: PairTrade;
  };
}

export interface AnalysisFocus {
    stock: Stock;
    factors: AlphaFactors;
    trend: Trend;
    activeStrategy?: HedgeFundStrategy;
    pairsSignal?: string;
}

export interface MlSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  predictedPriceChangePercent: number;
  featureImportance: { [key: string]: number };
}