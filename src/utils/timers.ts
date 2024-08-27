import Bull from 'bull';

type TimerJob = {
    address: string;
    amount: string;
    blockchain: string;
    expirationTime: number;
};

type TimerCallback = (error: Error | null, result: { address: string; amount: string; blockchain: string; expired: boolean }) => void;

export class Timers {
    private addressQueue: Bull.Queue<TimerJob>;
    private callbacks: Map<string, TimerCallback> = new Map();

    constructor(redisUrl: string) {
        this.addressQueue = new Bull<TimerJob>('addressQueue', redisUrl);
    }

    async setupTimers(): Promise<void> {
        await this.addressQueue.empty();
        this.addressQueue.process(async (job) => {
            const { address, amount, blockchain } = job.data;
            const callback = this.callbacks.get(address);
            if (callback) {
                callback(null, { address, amount, blockchain, expired: true });
                this.callbacks.delete(address);
            }
        });

        this.addressQueue.on('failed', (job, err) => {
            console.error(`Job failed for address ${job.data.address}:`, err);
            const callback = this.callbacks.get(job.data.address);
            if (callback) {
                callback(err, { address: job.data.address, amount: job.data.amount, blockchain: job.data.blockchain, expired: false });
                this.callbacks.delete(job.data.address);
            }
        });
    }

    async startTimer(
        address: string,
        amount: string,
        blockchain: string,
        callback: TimerCallback,
        expirationTime: number = 5 * 60 * 1000 // default to 5 minutes
    ): Promise<void> {
        this.callbacks.set(address, callback);
        await this.addressQueue.add(
            { address, amount, blockchain, expirationTime },
            { delay: expirationTime, jobId: address }
        );
    }

    async cancelTimer(address: string): Promise<boolean> {
        const job = await this.addressQueue.getJob(address);
        if (job) {
            await job.remove();
            this.callbacks.delete(address);
            return true;
        }
        return false;
    }

    async getActiveTimers(): Promise<TimerJob[]> {
        const jobs = await this.addressQueue.getJobs(['delayed', 'active']);
        return jobs.map(job => job.data);
    }

    async close(): Promise<void> {
        await this.addressQueue.close();
    }
}
