import QRCode from 'qrcode';
import { Database, type TransferSession } from './utils/db';
import { Ethereum } from './utils/ethereum';
import { Solana } from './utils/solana';
import { Timers } from './utils/timers';

type Blockchain = 'ethereum' | 'solana';

export class CryptoPaymentGateway {
    private ethereum: Ethereum;
    private solana: Solana;
    private database: Database;
    private timers: Timers;

    private readonly masterPrivateKey: string;

    constructor(ethereumRpcUrl: string, solanaRpcUrl: string, masterPrivateKey: string, redisUrl: string) {
        this.ethereum = new Ethereum(ethereumRpcUrl);
        this.solana = new Solana(solanaRpcUrl);
        this.database = new Database();
        this.timers = new Timers(redisUrl);
        this.masterPrivateKey = masterPrivateKey;
    }

    async init() {
        await this.database.init();
        await this.timers.setupTimers();
        this.ethereum.addWallet(this.masterPrivateKey, "master");
    }

    async initiateTransferSession(
        blockchain: Blockchain,
        amount: string,
        toUser: string,
        expirationTime: number = 15 * 60 * 1000 // Default to 15 minutes
    ): Promise<{ address: string, qrCode: string }> {
        const expiresAt = new Date(Date.now() + expirationTime);
        const addressIndex = await this.database.getNextAddressIndex(blockchain);
        const address = await this.generateAddress(blockchain, addressIndex.toString());
        await this.database.saveAddress(address, blockchain, addressIndex);
        const qrCode = await this.generateAddressQRCode(address);
        const sessionId = await this.database.createTransferSession(address, toUser, amount, expiresAt);

        this.monitorSession(sessionId, blockchain, address, amount, expirationTime);

        return { address, qrCode };
    }

    private async generateAddress(blockchain: Blockchain, label: string): Promise<string> {
        return blockchain === 'ethereum' ? await this.ethereum.generateAddress(label) : await this.solana.generateAddress("demo");
    }

    private async generateAddressQRCode(address: string): Promise<string> {
        return QRCode.toDataURL(address);
    }

    private monitorSession(sessionId: number, blockchain: Blockchain, address: string, amount: string, expirationTime: number) {
        const checkBalance = async () => {
            const balance = await this.getBalance(blockchain, address);
            if (typeof balance === 'number' && balance >= parseFloat(amount)) {
                await this.handleSuccessfulPayment(sessionId);
                return true;
            }
            return false;
        };

        this.timers.startTimer(
            address,
            amount,
            blockchain,
            async (error: any, result: { expired: any; }) => {
                if (error) {
                    console.error(`Error in timer for session ${sessionId}:`, error);
                    return;
                }
                if (result.expired) {
                    const paid = await checkBalance();
                    if (!paid) {
                        await this.handleExpiredSession(sessionId);
                    }
                }
            },
            expirationTime,
        );

        // Start monitoring transactions
        this.monitorTransactions(blockchain, address, async (transaction) => {
            if (transaction) {
                const paid = await checkBalance();
                if (paid) {
                    await this.timers.cancelTimer(address);
                }
            }
        });

        checkBalance(); // Check immediately once
    }

    private async getBalance(blockchain: Blockchain, address: string): Promise<number | bigint> {
        return blockchain === 'ethereum' ? await this.ethereum.getBalance(address) : await this.solana.getBalance(address);
    }

    private async handleSuccessfulPayment(sessionId: number): Promise<void> {
        await this.database.updateTransferSessionStatus(sessionId, 'completed');
        console.log(`Payment received for session ${sessionId}`);
        // handle notifications
    }

    private async handleExpiredSession(sessionId: number): Promise<void> {
        await this.database.updateTransferSessionStatus(sessionId, 'expired');
        console.log(`Session ${sessionId} expired`);
        // handle notifications
    }

    private monitorTransactions(blockchain: Blockchain, address: string, callback: (transaction: any) => void) {
        if (blockchain === 'ethereum') {
            this.ethereum.monitorTransactions((error, transaction) => {
                if (error) {
                    console.error('Error monitoring Ethereum transactions:', error);
                } else if (transaction && transaction.to === address) {
                    callback(transaction);
                }
            });
        } else {
            this.solana.monitorTransactions(address, (error, accountInfo) => {
                if (error) {
                    console.error('Error monitoring Solana transactions:', error);
                } else {
                    callback(accountInfo);
                }
            });
        }
    }

    async validateAddress(blockchain: Blockchain, address: string): Promise<boolean> {
        return blockchain === 'ethereum' ? await this.ethereum.validateAddress(address) : await this.solana.validateAddress(address);
    }

    async getTransferSession(sessionId: number): Promise<TransferSession | undefined> {
        return this.database.getTransferSession(sessionId);
    }

    async getPendingTransferSessions(): Promise<TransferSession[]> {
        return this.database.getPendingTransferSessions();
    }

    async close(): Promise<void> {
        await this.database.close();
        await this.timers.close();
    }
}