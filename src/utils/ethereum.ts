import { ethers } from 'ethers';

type TransactionCallback = (error: Error | null, transaction: ethers.TransactionResponse | null) => void;

export class Ethereum {
    private provider: ethers.JsonRpcProvider;
    private masterWallet: ethers.Wallet;

    constructor(rpcUrl: string, masterPrivateKey: string) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.masterWallet = new ethers.Wallet(masterPrivateKey, this.provider);
    }

    async generateAddress(): Promise<string> {
        this.masterWallet.connect(this.provider);
        return this.masterWallet.address;
    }

    async validateAddress(address: string) {
        const regex = /^0x[a-fA-F0-9]{40}$/;
        return regex.test(address);
    }


    async monitorTransactions(callback: TransactionCallback): Promise<void> {
        this.provider.on('pending', async (tx: string) => {
            try {
                const transaction = await this.provider.getTransaction(tx);
                if (transaction && BigInt(transaction.value.toString()) > 0n) {
                    callback(null, transaction);
                }
            } catch (error) {
                console.log(error);
            }
        });
    }
}
