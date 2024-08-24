import sqlite3 from 'sqlite3';

export class Database {
    public db: sqlite3.Database;

    constructor() {
        this.db = new sqlite3.Database('./payment_gateway.db', (err) => {
            if (err) {
                console.error('Could not connect to database', err);
            } else {
                console.log('Connected to database');
            }
        });
    }

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS addresses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    address TEXT UNIQUE,
                    chain TEXT,
                    index INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS transfer_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    address TEXT,
                    to_user TEXT,
                    amount TEXT,
                    status TEXT,
                    expires_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getNextAddressIndex(chain: string): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT MAX(index) as maxIndex FROM addresses WHERE chain = ?', [chain], (err, row: any) => {
                if (err) reject(err);
                else resolve((row?.maxIndex || 0) + 1);
            });
        });
    }

    async saveAddress(address: string, chain: string, index: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO addresses (address, chain, index) VALUES (?, ?, ?)', [address, chain, index], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async createTransferSession(address: string, toUser: string, amount: string, expiresAt: Date): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO transfer_sessions (address, to_user, amount, status, expires_at) VALUES (?, ?, ?, ?, ?)',
                [address, toUser, amount, 'pending', expiresAt.toISOString()],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async updateTransferSessionStatus(id: number, status: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE transfer_sessions SET status = ? WHERE id = ?', [status, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}