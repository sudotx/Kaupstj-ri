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

    async monitorTransactions(callback: (arg0: null, arg1: solana.AccountInfo<Buffer>) => void) {
        this.connection.onAccountChange(new solana.PublicKey("Solana address"), (accountInfo, context) => {
            callback(null, accountInfo);
        });
    }
}
