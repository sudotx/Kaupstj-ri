import { ethers } from 'ethers';

type TransactionCallback = (error: Error | null, transaction: ethers.TransactionResponse | null) => void;

export class Ethereum {
    private provider: ethers.JsonRpcProvider;

    constructor(rpcUrl: string) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    async generateAddress(): Promise<string> {
        const wallet = ethers.Wallet.createRandom();
        return wallet.address;
    }

    async monitorTransactions(callback: TransactionCallback): Promise<void> {
        this.provider.on('pending', async (tx: string) => {
            try {
                const transaction = await this.provider.getTransaction(tx);
                if (transaction && BigInt(transaction.value.toString()) > 0n) {
                    callback(null, transaction);
                }
            } catch (error) {
                // callback(error, null);
                console.log(error);
            }
        });
    }
}
