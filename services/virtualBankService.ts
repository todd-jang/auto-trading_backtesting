import { BankTransaction } from '../types';

type BankActionResponse = {
    success: boolean;
    newBalance: number;
    transaction?: BankTransaction;
    message?: string;
};

class VirtualBankApiClient {
    public async getBankData(): Promise<{ balance: number; transactions: BankTransaction[] }> {
        try {
            const response = await fetch('/api/bank-data');
            if (!response.ok) throw new Error('Failed to fetch bank data');
            return await response.json();
        } catch (error) {
            console.error(error);
            return { balance: 0, transactions: [] };
        }
    }

    public async withdraw(amount: number): Promise<BankActionResponse> {
        return this.performTransaction('withdraw', amount);
    }

    public async deposit(amount: number): Promise<BankActionResponse> {
        return this.performTransaction('deposit', amount);
    }

    private async performTransaction(type: 'withdraw' | 'deposit', amount: number): Promise<BankActionResponse> {
        try {
            const response = await fetch(`/api/bank-${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount }),
            });
            return await response.json();
        } catch (error) {
            console.error(`Bank ${type} error:`, error);
            return { success: false, newBalance: 0, message: 'Client-side error' };
        }
    }
}

export const virtualBankService = new VirtualBankApiClient();
