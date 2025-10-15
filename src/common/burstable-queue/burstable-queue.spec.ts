import { BurstableQueue } from './burstable-queue';
import { setTimeout } from 'node:timers/promises';

describe('burstable-queue', () => {
  it('should schedule task and execute them with an initial burst', async () => {
    const interval = 500;
    const burstableQueue = new BurstableQueue({
      concurrency: 1,
      minTime: 0,
      burstIntervalCap: 4,
      sustainedIntervalCap: 1,
      interval
    });
    const tasks = [...Array.from({ length: 8 }).keys()];
    const completeTasks: number[] = [];

    for (const task of tasks) {
      burstableQueue.add(async () => {
        await setTimeout(50);
        completeTasks.push(task);
      });
    }

    expect(burstableQueue.size()).toEqual(8);
    expect(completeTasks).toHaveLength(0);
    await setTimeout(interval);
    expect(burstableQueue.size()).toEqual(4);
    expect(completeTasks).toHaveLength(4);
    await setTimeout(interval);
    expect(burstableQueue.size()).toEqual(3);
    expect(completeTasks).toHaveLength(5);
    await setTimeout(interval);
    expect(burstableQueue.size()).toEqual(2);
    expect(completeTasks).toHaveLength(6);
    await setTimeout(interval);
    expect(burstableQueue.size()).toEqual(1);
    expect(completeTasks).toHaveLength(7);
    await setTimeout(interval);
    expect(burstableQueue.size()).toEqual(0);
    expect(completeTasks).toHaveLength(8);
  });

  describe('add', () => {
    it('should add a task to the queue', () => {
      const burstableQueue = new BurstableQueue({});
      burstableQueue.add(async () => {
        await setTimeout(50);
      });
      expect(burstableQueue.size()).toEqual(1);
    });
  });

  describe('onIdle', () => {
    it('should wait until the the queue is idle (queue is empty and all tasks executed)', async () => {
      const burstableQueue = new BurstableQueue({
        concurrency: 1,
        minTime: 0,
        burstIntervalCap: 4,
        sustainedIntervalCap: 1,
        interval: 400
      });
      const tasks = [...Array.from({ length: 8 }).keys()];
      const completeTasks: number[] = [];

      for (const task of tasks) {
        burstableQueue.add(async () => {
          await setTimeout(50);
          completeTasks.push(task);
        });
      }

      await burstableQueue.onIdle();

      expect(burstableQueue.size()).toEqual(0);
      expect(completeTasks).toHaveLength(8);
    });
  });
  describe('size()', () => {
    it('should return the size of the queue (queued and executing) - all queued', () => {
      const burstableQueue = new BurstableQueue({
        concurrency: 1,
        minTime: 0,
        burstIntervalCap: 4,
        sustainedIntervalCap: 1,
        interval: 400
      });
      const tasks = [...Array.from({ length: 8 }).keys()];

      tasks.forEach(() => {
        burstableQueue.add(async () => {
          await setTimeout(50);
        });
      });

      expect(burstableQueue.size()).toEqual(8);
    });
    it('should return the size of the queue (queued and executing) - queue task in flight', async () => {
      const burstableQueue = new BurstableQueue({
        concurrency: 1,
        minTime: 0,
        burstIntervalCap: 4,
        sustainedIntervalCap: 1,
        interval: 400
      });
      const tasks = [...Array.from({ length: 8 }).keys()];

      tasks.forEach(() => {
        burstableQueue.add(async () => {
          await setTimeout(50);
        });
      });

      expect(burstableQueue.size()).toEqual(8);
      await setTimeout(400);
      expect(burstableQueue.size()).toEqual(4);
    });
  });
  describe('pending()', () => {
    it('should return the number of pending queue items (queued, not executing)', () => {
      const burstableQueue = new BurstableQueue({
        concurrency: 1,
        minTime: 0,
        burstIntervalCap: 4,
        sustainedIntervalCap: 1,
        interval: 400
      });
      const tasks = [...Array.from({ length: 8 }).keys()];

      tasks.forEach(() => {
        burstableQueue.add(async () => {
          await setTimeout(50);
        });
      });

      expect(burstableQueue.pending()).toEqual(8);
    });
    it('should return the number of pending queue items (queued, not executing) - queue task in flight', async () => {
      const burstableQueue = new BurstableQueue({
        concurrency: 1,
        minTime: 0,
        burstIntervalCap: 4,
        sustainedIntervalCap: 1,
        interval: 400
      });
      const tasks = [...Array.from({ length: 8 }).keys()];

      tasks.forEach(() => {
        burstableQueue.add(async () => {
          await setTimeout(50);
        });
      });

      expect(burstableQueue.pending()).toEqual(8);
      await setTimeout(400);
      expect(burstableQueue.pending()).toEqual(4);
    });
  });
});
