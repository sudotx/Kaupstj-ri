import solana from '@solana/web3.js';

export class Solana {
    connection: solana.Connection;

    constructor(rpcUrl: string) {
        this.connection = new solana.Connection(rpcUrl);
    }

    async generateAddress() {
        const keypair = solana.Keypair.generate();
        return keypair.publicKey.toBase58();
    }
    async getBalance(address: string): Promise<number> {
        const balance = await this.connection.getBalance(new solana.PublicKey(address));
        return balance / solana.LAMPORTS_PER_SOL;
    }
    async validateAddress(address: string) {
        // Implement address validation logic
        const regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        return regex.test(address);
    }

    async monitorTransactions(callback: (arg0: null, arg1: solana.AccountInfo<Buffer>) => void) {
        this.connection.onAccountChange(new solana.PublicKey("Solana address"), (accountInfo, context) => {
            callback(null, accountInfo);
        });
    }
}
