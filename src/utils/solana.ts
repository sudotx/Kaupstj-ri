import * as solana from '@solana/web3.js';

type TransactionCallback = (error: Error | null, transaction: solana.TransactionResponse | null) => void;

export class Solana {
    private connection: solana.Connection;
    private wallets: Map<string, solana.Keypair> = new Map();

    constructor(rpcUrl: string) {
        this.connection = new solana.Connection(rpcUrl);
    }

    addWallet(secretKey: Uint8Array, label: string): void {
        const keypair = solana.Keypair.fromSecretKey(secretKey);
        this.wallets.set(label, keypair);
    }

    async generateAddress(label: string): Promise<string> {
        const keypair = solana.Keypair.generate();
        this.wallets.set(label, keypair);
        return keypair.publicKey.toBase58();
    }

    async getBalance(address: string): Promise<number> {
        try {
            const publicKey = new solana.PublicKey(address);
            const balance = await this.connection.getBalance(publicKey);
            return balance / solana.LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error getting balance:', error);
            throw error;
        }
    }

    async validateAddress(address: string): Promise<boolean> {
        try {
            new solana.PublicKey(address);
            return true;
        } catch {
            return false;
        }
    }

    async sendTransaction(from: string, to: string, amount: number): Promise<string> {
        try {
            const fromWallet = this.wallets.get(from);
            if (!fromWallet) throw new Error('Sender wallet not found');

            const toPublicKey = new solana.PublicKey(to);
            const transaction = new solana.Transaction().add(
                solana.SystemProgram.transfer({
                    fromPubkey: fromWallet.publicKey,
                    toPubkey: toPublicKey,
                    lamports: amount * solana.LAMPORTS_PER_SOL,
                })
            );

            const signature = await solana.sendAndConfirmTransaction(
                this.connection,
                transaction,
                [fromWallet]
            );

            return signature;
        } catch (error) {
            console.error('Error sending transaction:', error);
            throw error;
        }
    }

    async monitorTransactions(address: string, callback: TransactionCallback): Promise<number> {
        try {
            const publicKey = new solana.PublicKey(address);
            return this.connection.onLogs(publicKey, (logs, context) => {
                if (logs.err) {
                    callback(new Error(logs.err.toString()), null);
                } else {
                    // parse the logs to create a TransactionResponse object
                    callback(null, logs as any);
                }
            }, 'confirmed');
        } catch (error) {
            console.error('Error monitoring transactions:', error);
            throw error;
        }
    }

    async getTransactionHistory(address: string): Promise<solana.ConfirmedSignatureInfo[]> {
        try {
            const publicKey = new solana.PublicKey(address);
            return await this.connection.getSignaturesForAddress(publicKey);
        } catch (error) {
            console.error('Error getting transaction history:', error);
            throw error;
        }
    }
}
