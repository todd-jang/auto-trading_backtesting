import React from 'react';
import { BankTransaction, TransactionType } from '../../types';

interface VirtualBankProps {
    balance: number;
    transactions: BankTransaction[];
}

const formatKrw = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

const TransactionIcon: React.FC<{ type: TransactionType }> = ({ type }) => {
    if (type === TransactionType.WITHDRAWAL) {
        return ( // Arrow pointing out to portfolio
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m6 4H9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5" />
            </svg>
        );
    }
    return ( // Arrow pointing in from portfolio
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m6 4H9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5 5-5" />
        </svg>
    );
};

const VirtualBank: React.FC<VirtualBankProps> = ({ balance, transactions }) => {
    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md dark:shadow-lg p-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">가상 은행 계좌</h2>
            <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500 dark:text-gray-400">계좌 잔고</span>
                <span className="text-2xl font-bold text-blue-500 dark:text-blue-400">{formatKrw(balance)}</span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">최근 거래 내역</h3>
                {transactions.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">거래 내역이 없습니다.</p>}
                {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md">
                        <div className="flex items-center space-x-2">
                            <TransactionIcon type={tx.type} />
                            <div>
                                <p className={`text-sm font-medium ${tx.type === TransactionType.WITHDRAWAL ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    {tx.type === TransactionType.WITHDRAWAL ? '포트폴리오로 출금' : '포트폴리오에서 입금'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{tx.timestamp}</p>
                            </div>
                        </div>
                        <p className="text-sm font-mono">{formatKrw(tx.amount)}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VirtualBank;
