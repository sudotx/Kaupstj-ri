import QRCode from 'qrcode';
import { Database } from './utils/db';
import { Ethereum } from './utils/ethereum';
import { Solana } from './utils/solana';

type Blockchain = 'ethereum' | 'solana';

export class CryptoPaymentGateway {
    private ethereum: Ethereum;
    private solana: Solana;
    public database: Database;

    constructor(ethereumRpcUrl: string, solanaRpcUrl: string, masterPrivateKey: string) {
        this.ethereum = new Ethereum(ethereumRpcUrl, masterPrivateKey);
        this.solana = new Solana(solanaRpcUrl);
        this.database = new Database();
    }

    async init() {
        await this.database.init();
    }

    async initiateTransferSession(
        blockchain: Blockchain,
        amount: string,
        expirationTime: number = 15 * 60 * 1000 // Default to 15 minutes
    ): Promise<{ address: string, qrCode: string }> {
        const expiresAt = new Date(Date.now() + expirationTime);
        const addressIndex = await this.database.getNextAddressIndex(blockchain);
        const address = await this.generateAddress(blockchain);
        await this.database.saveAddress(address, blockchain, addressIndex);
        const qrCode = await this.generateAddressQRCode(address);
        const sessionId = await this.database.createTransferSession(address, amount, expiresAt);

        this.monitorSession(sessionId, blockchain, address, amount, expirationTime);

        return { address, qrCode };
    }

    private async generateAddress(blockchain: Blockchain): Promise<string> {
        return blockchain === 'ethereum' ? await this.ethereum.generateAddress() : await this.solana.generateAddress();
    }

    private async generateAddressQRCode(address: string): Promise<string> {
        return new Promise((resolve, reject) => {
            QRCode.toDataURL(address, (err, url) => {
                if (err) reject(err);
                else resolve(url);
            });
        });
    }

    private monitorSession(sessionId: number, blockchain: Blockchain, address: string, amount: string, expirationTime: number) {
        const checkBalance = async () => {
            const balance = `${await this.getBalance(blockchain, address)}`;
            if (parseFloat(balance) >= parseFloat(amount)) {
                clearTimeout(expirationTimer);
                clearInterval(checkInterval);
                await this.handleSuccessfulPayment(sessionId);
            }
        };

        const checkInterval = setInterval(checkBalance, 10000); // Check every 10 seconds

        const expirationTimer = setTimeout(async () => {
            clearInterval(checkInterval);
            await this.handleExpiredSession(sessionId);
        }, expirationTime);

        checkBalance(); // Check immediately once
    }

    private async getBalance(blockchain: Blockchain, address: string): Promise<number> {
        return blockchain === 'ethereum' ? await this.ethereum.getBalance(address) : await this.solana.getBalance(address);
    }

    private async handleSuccessfulPayment(sessionId: number): Promise<void> {
        await this.database.updateTransferSessionStatus(sessionId, 'completed');
        console.log(`Payment received for session ${sessionId}`);
    }

    private async handleExpiredSession(sessionId: number): Promise<void> {
        await this.database.updateTransferSessionStatus(sessionId, 'expired');
        console.log(`Session ${sessionId} expired`);
    }

    async close(): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            this.database.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}