import type { ethers } from 'ethers';
import QRCode from 'qrcode';
import { Database } from './utils/db';
import { Ethereum } from './utils/ethereum';
import { Solana } from './utils/solana';
import { Timers } from './utils/timers';

// Define callback types for payment sessions and transaction monitoring
type PaymentCallback = (error: Error | null, result: any) => void;
type TransactionCallback = (error: Error | null, transaction: ethers.TransactionResponse | null) => void;

export class CryptoPaymentGateway {
    private ethereum: Ethereum;  // Instance for Ethereum operations
    private solana: Solana;      // Instance for Solana operations
    private timers: Timers;      // Instance for timer management
    public database: Database;  // Instance for database operations

    /**
     * Initializes the CryptoPaymentGateway with the provided RPC URLs for Ethereum and Solana.
     * Sets up the timer management system.
     * 
     * @param ethereumRpcUrl - The RPC URL for the Ethereum blockchain.
     * @param solanaRpcUrl - The RPC URL for the Solana blockchain.
     */
    constructor(ethereumRpcUrl: string, solanaRpcUrl: string, masterPrivateKey: string) {
        this.ethereum = new Ethereum(ethereumRpcUrl, masterPrivateKey);
        this.solana = new Solana(solanaRpcUrl);
        this.timers = new Timers();
        this.timers.setupTimers();  // Initialize timers

        this.database = new Database();  // Initialize the database
    }

    async generateAddressQRCode(address: string): Promise<string> {
        return new Promise((resolve, reject) => {
            QRCode.toDataURL(address, (err, url) => {
                if (err) reject(err);
                else resolve(url);
            });
        });
    }

    async init() {
        await this.database.init();
    }

    async createEthereumTransferSession(
        toUser: string,
        amount: string,
        callback: PaymentCallback,
        options: { expirationTime?: number } = {}
    ): Promise<{ address: string, qrCode: string }> {
        const expirationTime = options.expirationTime || 5 * 60 * 1000; // Default to 5 minutes
        const expiresAt = new Date(Date.now() + expirationTime);

        const addressIndex = await this.database.getNextAddressIndex('ethereum');
        const address = await this.ethereum.generateAddress();
        await this.database.saveAddress(address, 'ethereum', addressIndex);

        const sessionId = await this.database.createTransferSession(address, toUser, amount, expiresAt);
        const qrCode = await this.generateAddressQRCode(address);

        this.ethereum.monitorTransactions(callback)

        setTimeout(async () => {
            await this.handleExpiredSession(sessionId, callback);
        }, expirationTime);

        return { address, qrCode };
    }

    async createSolanaTransferSession(
        toUser: string,
        amount: string,
        callback: PaymentCallback,
        options: { expirationTime?: number } = {}
    ): Promise<{ address: string, qrCode: string }> {
        const expirationTime = options.expirationTime || 5 * 60 * 1000; // Default to 5 minutes
        const expiresAt = new Date(Date.now() + expirationTime);

        const addressIndex = await this.database.getNextAddressIndex('solana');
        const address = await this.solana.generateAddress();
        await this.database.saveAddress(address, 'solana', addressIndex);
        const qrCode = await this.generateAddressQRCode(address);
        const sessionId = await this.database.createTransferSession(address, toUser, amount, expiresAt);

        if (sessionId) {
            this.solana.monitorTransactions(callback);
            setTimeout(async () => {
                await this.handleExpiredSession(sessionId, callback);
            }, expirationTime);
        } else {
            this.handleSuccessfulPayment(sessionId, 'transactionHash', callback);
        }

        return { address, qrCode };
    }

    private async handleSuccessfulPayment(sessionId: number, transactionHash: string, callback: PaymentCallback): Promise<void> {
        await this.database.updateTransferSessionStatus(sessionId, 'completed');
        callback(null, { sessionId, transactionHash, status: 'completed' });
    }

    private async handleExpiredSession(sessionId: number, callback: PaymentCallback): Promise<void> {
        await this.database.updateTransferSessionStatus(sessionId, 'expired');
        callback(null, { sessionId, status: 'expired' });
    }

    async close(): Promise<void> {
        // Close database connection
        await new Promise<void>((resolve, reject) => {
            this.database.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}


async function main() {
    const gateway = new CryptoPaymentGateway(
        'https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID',
        'https://api.mainnet-beta.solana.com',
        'your_master_private_key_here'
    );

    await gateway.init();

    try {
        // const { address, qrCode } = await gateway.createTransferSession(
        //     'recipientUserId',
        //     0.1, // Amount in ETH
        //     (error, result) => {
        //         if (error) console.error('Transfer session error:', error);
        //         if (result?.expired) console.log('Transfer session expired');
        //     },
        //     { expirationTime: 15 * 60 * 1000 } // 15 minutes
        // );

        // console.log('Transfer address:', address);
        // console.log('QR Code:', qrCode);
    } finally {
        // Ensure the database is closed when the program exits
        await gateway.close();
    }
}

main().catch(console.error);