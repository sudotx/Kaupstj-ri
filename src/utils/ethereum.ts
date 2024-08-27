import { ethers } from 'ethers';

type TransactionCallback = (error: Error | null, transaction: ethers.TransactionResponse | null) => void;

export class Ethereum {
    private provider: ethers.JsonRpcProvider;
    private wallets: Map<string, ethers.Wallet | ethers.HDNodeWallet> = new Map();

    constructor(rpcUrl: string) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    addWallet(privateKey: string, label: string): void {
        const wallet = new ethers.Wallet(privateKey, this.provider);
        this.wallets.set(label, wallet);
    }

    async generateAddress(label: string): Promise<string> {
        const wallet = ethers.Wallet.createRandom().connect(this.provider);
        this.wallets.set(label, wallet);
        return wallet.address;
    }

    async validateAddress(address: string): Promise<boolean> {
        return ethers.isAddress(address);
    }


    async getBalance(address: string): Promise<bigint> {
        try {
            return await this.provider.getBalance(address);
        } catch (error) {
            console.error('Error getting balance:', error);
            throw error;
        }
    }

    async sendTransaction(fromLabel: string, toAddress: string, amount: bigint): Promise<ethers.TransactionResponse> {
        const wallet = this.wallets.get(fromLabel);
        if (!wallet) {
            throw new Error('Wallet not found');
        }
        try {
            return await wallet.sendTransaction({
                to: toAddress,
                value: amount,
            });
        } catch (error) {
            console.error('Error sending transaction:', error);
            throw error;
        }
    }

    async estimateGas(fromLabel: string, toAddress: string, amount: bigint): Promise<bigint> {
        const wallet = this.wallets.get(fromLabel);
        if (!wallet) {
            throw new Error('Wallet not found');
        }
        try {
            return await wallet.estimateGas({
                to: toAddress,
                value: amount,
            });
        } catch (error) {
            console.error('Error estimating gas:', error);
            throw error;
        }
    }

    async callContract(contractAddress: string, abi: ethers.InterfaceAbi, method: string, params: any[]): Promise<any> {
        try {
            const contract = new ethers.Contract(contractAddress, abi, this.provider);
            return await contract[method](...params);
        } catch (error) {
            console.error('Error calling contract:', error);
            throw error;
        }
    }

    async listenToContractEvents(contractAddress: string, abi: ethers.InterfaceAbi, eventName: string, callback: (event: any) => void): Promise<void> {
        try {
            const contract = new ethers.Contract(contractAddress, abi, this.provider);
            contract.on(eventName, callback);
        } catch (error) {
            console.error('Error listening to contract events:', error);
            throw error;
        }
    }

    async monitorTransactions(callback: TransactionCallback): Promise<void> {
        this.provider.on('pending', async (tx: string) => {
            try {
                const transaction = await this.provider.getTransaction(tx);
                if (transaction && transaction.value > 0n) {
                    callback(null, transaction);
                }
            } catch (error) {
                console.error('Error monitoring transactions:', error);
                callback(error as Error, null);
            }
        });
    }

    // async getTransactionHistory(address: string, startBlock: number, endBlock: number): Promise<ethers.TransactionResponse[]> {
    //     try {
    //         const history = await this.provider.getHistory(address, startBlock, endBlock);
    //         return history;
    //     } catch (error) {
    //         console.error('Error getting transaction history:', error);
    //         throw error;
    //     }
    // }
}
