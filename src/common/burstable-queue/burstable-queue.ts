import Bottleneck from 'bottleneck';

export const CONCURRENCY = 4;
export const MIN_TIME = 1000;
export const INITIAL_RESERVOIR = 70;
export const RESERVOIR_REFRESH_AMOUNT = 30;
export const RESERVOIR_INCREASE_INTERVAL = 60_000;

export interface BurstableQueueOptions {
  concurrency?: number;
  minTime?: number;
  burstIntervalCap?: number;
  sustainedIntervalCap?: number;
  interval?: number;
}

export class BurstableQueue {
  private queue;

  constructor(options: BurstableQueueOptions) {
    this.queue = new Bottleneck({
      maxConcurrent: options.concurrency || CONCURRENCY,
      minTime: options.minTime ?? MIN_TIME,
      reservoir: options.burstIntervalCap || INITIAL_RESERVOIR, // initial value
      reservoirRefreshAmount: options.sustainedIntervalCap || RESERVOIR_REFRESH_AMOUNT,
      reservoirRefreshInterval: options.interval || RESERVOIR_INCREASE_INTERVAL
    });
  }

  size(): number {
    const { RECEIVED, QUEUED, RUNNING, EXECUTING } = this.queue.counts();
    return RECEIVED + QUEUED + RUNNING + EXECUTING;
  }

  pending(): number {
    const { RECEIVED, QUEUED } = this.queue.counts();
    return RECEIVED + QUEUED;
  }

  async onIdle(): Promise<void> {
    if (this.size() === 0) {
      return;
    }

    return new Promise(resolve => {
      this.queue.on('idle', () => {
        resolve();
      });
    });
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return this.queue.schedule<T>(fn);
  }
}
