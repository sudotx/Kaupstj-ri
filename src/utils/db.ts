import sqlite3 from 'sqlite3';

export interface Address {
    id: number;
    address: string;
    chain: string;
    index: number;
    created_at: string;
}

export interface TransferSession {
    id: number;
    address: string;
    to_user: string;
    amount: string;
    status: 'pending' | 'completed' | 'expired' | 'failed';
    expires_at: string;
    created_at: string;
}

export class Database {
    private db: sqlite3.Database;

    constructor(dbPath: string = './payment_gateway.db') {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Could not connect to database', err);
            } else {
                console.log('Connected to database');
            }
        });
    }

    async init(): Promise<void> {
        const queries = [
            `CREATE TABLE IF NOT EXISTS addresses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                address TEXT UNIQUE,
                chain TEXT,
                index INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS transfer_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                address TEXT,
                to_user TEXT,
                amount TEXT,
                status TEXT CHECK(status IN ('pending', 'completed', 'expired', 'failed')),
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE INDEX IF NOT EXISTS idx_addresses_chain ON addresses(chain)`,
            `CREATE INDEX IF NOT EXISTS idx_transfer_sessions_address ON transfer_sessions(address)`,
            `CREATE INDEX IF NOT EXISTS idx_transfer_sessions_status ON transfer_sessions(status)`
        ];

        for (const query of queries) {
            await this.run(query);
        }
    }

    private async run(sql: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    private async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row as T);
            });
        });
    }

    private async all<T>(sql: string, params: any[] = []): Promise<T[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows as T[]);
            });
        });
    }

    async getNextAddressIndex(chain: string): Promise<number> {
        const row = await this.get<{ maxIndex: number }>('SELECT MAX(index) as maxIndex FROM addresses WHERE chain = ?', [chain]);
        return (row?.maxIndex || 0) + 1;
    }

    async saveAddress(address: string, chain: string, index: number): Promise<void> {
        await this.run('INSERT INTO addresses (address, chain, index) VALUES (?, ?, ?)', [address, chain, index]);
    }

    async getAddress(address: string): Promise<Address | undefined> {
        return this.get<Address>('SELECT * FROM addresses WHERE address = ?', [address]);
    }

    async getAddressesByChain(chain: string): Promise<Address[]> {
        return this.all<Address>('SELECT * FROM addresses WHERE chain = ? ORDER BY index', [chain]);
    }

    async createTransferSession(address: string, to_user: string, amount: string, expiresAt: Date): Promise<number> {
        const result = await this.run(
            'INSERT INTO transfer_sessions (address, to_user, amount, status, expires_at) VALUES (?, ?, ?, ?, ?)',
            [address, to_user, amount, 'pending', expiresAt.toISOString()]
        );
        return (result as any).lastID;
    }

    async updateTransferSessionStatus(id: number, status: TransferSession['status']): Promise<void> {
        await this.run('UPDATE transfer_sessions SET status = ? WHERE id = ?', [status, id]);
    }

    async getTransferSession(id: number): Promise<TransferSession | undefined> {
        return this.get<TransferSession>('SELECT * FROM transfer_sessions WHERE id = ?', [id]);
    }

    async getTransferSessionsByAddress(address: string): Promise<TransferSession[]> {
        return this.all<TransferSession>('SELECT * FROM transfer_sessions WHERE address = ? ORDER BY created_at DESC', [address]);
    }

    async getPendingTransferSessions(): Promise<TransferSession[]> {
        return this.all<TransferSession>('SELECT * FROM transfer_sessions WHERE status = ? ORDER BY expires_at', ['pending']);
    }

    async close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}