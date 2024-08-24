import Bull from 'bull';

type TimerJob = {
    address: string;
    callback: (error: Error | null, result: { address: string; expired: boolean }) => void;
};

export class Timers {
    private addressQueue: Bull.Queue<TimerJob>;

    constructor() {
        this.addressQueue = new Bull<TimerJob>('addressQueue');
    }

    setupTimers(): void {
        this.addressQueue.process(async (job) => {
            const { address, callback } = job.data;
            if (callback) {
                callback(null, { address, expired: true });
            }
        });
    }

    startTimer(
        address: string,
        callback: (error: Error | null, result: any) => void,
        expirationTime: number = 5 * 60 * 1000 // Default to 5 minutes
    ): void {
        // Add a job to the queue with the specified delay and data
        this.addressQueue.add({ address, callback }, { delay: expirationTime });
    }
}
