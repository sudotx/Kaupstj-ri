import type { ethers } from 'ethers';
import { Ethereum } from './ethereum';
import { Solana } from './solana';
import { Timers } from './timers';

// Define callback types for payment sessions and transaction monitoring
type PaymentCallback = (error: Error | null, result: any) => void;
type TransactionCallback = (error: Error | null, transaction: ethers.TransactionResponse | null) => void;

export class CryptoPaymentGateway {
    private ethereum: Ethereum;  // Instance for Ethereum operations
    private solana: Solana;      // Instance for Solana operations
    private timers: Timers;      // Instance for timer management

    /**
     * Initializes the CryptoPaymentGateway with the provided RPC URLs for Ethereum and Solana.
     * Sets up the timer management system.
     * 
     * @param ethereumRpcUrl - The RPC URL for the Ethereum blockchain.
     * @param solanaRpcUrl - The RPC URL for the Solana blockchain.
     */
    constructor(ethereumRpcUrl: string, solanaRpcUrl: string) {
        this.ethereum = new Ethereum(ethereumRpcUrl);
        this.solana = new Solana(solanaRpcUrl);
        this.timers = new Timers();

        this.timers.setupTimers();  // Initialize timers
    }

    /**
     * Creates a new Ethereum payment session, generating an address and starting a timer for it.
     * 
     * @param callback - The callback function invoked when the timer expires.
     * @param options - Optional settings for the payment session.
     * @param options.expirationTime - The time (in milliseconds) before the address expires. Defaults to 5 minutes.
     * @param options.metadata - Optional metadata associated with the payment session.
     * @returns A promise that resolves to the generated Ethereum address.
     */
    async createEthereumPaymentSession(
        callback: PaymentCallback,
        options: { expirationTime?: number; metadata?: any } = {}
    ): Promise<string> {
        const expirationTime = options.expirationTime || 5 * 60 * 1000; // Default to 5 minutes
        const metadata = options.metadata || {};

        // Generate a new Ethereum address
        const address = await this.ethereum.generateAddress();

        // Start a timer for the address with the specified expiration time
        this.timers.startTimer(address, callback, expirationTime);

        return address;
    }

    /**
     * Creates a new Solana payment session, generating an address and starting a timer for it.
     * 
     * @param callback - The callback function invoked when the timer expires.
     * @returns A promise that resolves to the generated Solana address.
     */
    async createSolanaPaymentSession(
        callback: PaymentCallback
    ): Promise<string> {
        // Generate a new Solana address
        const address = await this.solana.generateAddress();

        // Start a timer for the address with the default expiration time
        this.timers.startTimer(address, callback);

        return address;
    }

    /**
     * Monitors Ethereum transactions and triggers the provided callback on transaction events.
     * 
     * @param callback - The callback function invoked when a transaction is detected.
     * @returns A promise that resolves when the monitoring setup is complete.
     */
    async monitorEthereumTransactions(
        callback: TransactionCallback
    ): Promise<void> {
        await this.ethereum.monitorTransactions(callback);
    }

    /**
     * Monitors Solana transactions and triggers the provided callback on transaction events.
     * 
     * @param callback - The callback function invoked when a transaction is detected.
     * @returns A promise that resolves when the monitoring setup is complete.
     */
    async monitorSolanaTransactions(
        callback: PaymentCallback
    ): Promise<void> {
        await this.solana.monitorTransactions(callback);
    }
}
