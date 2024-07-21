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

    startTimer(address: string, callback: TimerJob['callback']): void {
        this.addressQueue.add({ address, callback }, { delay: 5 * 60 * 1000 }); // 5 minutes
    }
}
