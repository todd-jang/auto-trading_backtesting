
import { Stock, StockSymbol, Currency } from './types';

export const STOCKS: { [key in StockSymbol]: Stock } = {
  [StockSymbol.SAMSUNG]: {
    symbol: StockSymbol.SAMSUNG,
    name: 'Samsung Electronics',
    koreanName: '삼성전자',
    currency: Currency.KRW
  },
  [StockSymbol.HYNIX]: {
    symbol: StockSymbol.HYNIX,
    name: 'SK Hynix',
    koreanName: 'SK하이닉스',
    currency: Currency.KRW
  },
  [StockSymbol.NVIDIA]: {
    symbol: StockSymbol.NVIDIA,
    name: 'NVIDIA Corp',
    koreanName: '엔비디아',
    currency: Currency.USD
  },
  [StockSymbol.TSMC]: {
    symbol: StockSymbol.TSMC,
    name: 'TSMC',
    koreanName: 'TSMC',
    currency: Currency.USD
  },
  [StockSymbol.MICRON]: {
    symbol: StockSymbol.MICRON,
    name: 'Micron Technology',
    koreanName: '마이크론',
    currency: Currency.USD
  },
};

export const STOCK_COLORS: { [key in StockSymbol]: string } = {
  [StockSymbol.SAMSUNG]: '#38BDF8', // sky-400
  [StockSymbol.HYNIX]: '#34D399', // emerald-400
  [StockSymbol.NVIDIA]: '#A78BFA', // violet-400
  [StockSymbol.TSMC]: '#FBBF24', // amber-400
  [StockSymbol.MICRON]: '#F472B6', // pink-400
};
