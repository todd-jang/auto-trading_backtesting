import { BankTransaction, TransactionType } from '../types';

class VirtualBankService {
    private balance: number = 20_000_000;
    private transactions: BankTransaction[] = [];

    constructor() {
        console.log("Virtual Bank Initialized with Balance:", this.balance);
    }

    private simulateLatency(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    }
    
    public getBalance(): number {
        return this.balance;
    }

    public getTransactions(): BankTransaction[] {
        return [...this.transactions];
    }

    public async withdraw(amount: number): Promise<{ success: boolean; newBalance: number; transaction?: BankTransaction; }> {
        await this.simulateLatency();
        if (amount <= 0) {
            return { success: false, newBalance: this.balance };
        }
        if (this.balance < amount) {
            console.error("Virtual Bank: Withdrawal failed. Insufficient funds.");
            return { success: false, newBalance: this.balance };
        }
        
        this.balance -= amount;
        const transaction: BankTransaction = {
            id: `txn_${Date.now()}_${Math.random()}`,
            timestamp: new Date().toLocaleTimeString([], { hour12: false }),
            type: TransactionType.WITHDRAWAL,
            amount,
        };
        this.transactions.unshift(transaction);
        if (this.transactions.length > 50) {
            this.transactions.pop();
        }
        
        return { success: true, newBalance: this.balance, transaction };
    }

    public async deposit(amount: number): Promise<{ success: boolean; newBalance: number; transaction?: BankTransaction; }> {
        await this.simulateLatency();
        if (amount <= 0) {
            return { success: false, newBalance: this.balance };
        }

        this.balance += amount;
         const transaction: BankTransaction = {
            id: `txn_${Date.now()}_${Math.random()}`,
            timestamp: new Date().toLocaleTimeString([], { hour12: false }),
            type: TransactionType.DEPOSIT,
            amount,
        };
        this.transactions.unshift(transaction);
        if (this.transactions.length > 50) {
            this.transactions.pop();
        }

        return { success: true, newBalance: this.balance, transaction };
    }
}

export const virtualBankService = new VirtualBankService();
