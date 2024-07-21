import type { ethers } from 'ethers';
import { Ethereum } from './ethereum';
import { Solana } from './solana';
import { Timers } from './timers';

type PaymentCallback = (error: Error | null, result: any) => void;
type TransactionCallback = (error: Error | null, transaction: ethers.TransactionResponse | null) => void;

export class CryptoPaymentGateway {
    private ethereum: Ethereum;
    private solana: Solana;
    private timers: Timers;

    constructor(ethereumRpcUrl: string, solanaRpcUrl: string) {
        this.ethereum = new Ethereum(ethereumRpcUrl);
        this.solana = new Solana(solanaRpcUrl);
        this.timers = new Timers();

        this.timers.setupTimers();
    }

    async createEthereumPaymentSession(callback: PaymentCallback): Promise<string> {
        const address = await this.ethereum.generateAddress();
        this.timers.startTimer(address, callback);
        return address;
    }

    async createSolanaPaymentSession(callback: PaymentCallback): Promise<string> {
        const address = await this.solana.generateAddress();
        this.timers.startTimer(address, callback);
        return address;
    }

    async monitorEthereumTransactions(callback: TransactionCallback): Promise<void> {
        await this.ethereum.monitorTransactions(callback);
    }

    async monitorSolanaTransactions(callback: PaymentCallback): Promise<void> {
        await this.solana.monitorTransactions(callback);
    }
}
