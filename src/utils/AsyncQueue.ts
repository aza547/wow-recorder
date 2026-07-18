export default class AsyncQueue {
  private queue: (() => Promise<void>)[] = [];
  private running = false;
  private limit: number; // Limit the queued tasks.
  private latestCompletion: Promise<void> = Promise.resolve();

  constructor(limit: number) {
    this.limit = limit;
  }

  public add(task: () => Promise<void>): Promise<void> {
    // Just drop any tasks added over the limit.
    if (this.queue.length >= this.limit) return this.latestCompletion;

    const completion = new Promise<void>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await task();
          resolve();
        } catch (error) {
          reject(error);
          throw error;
        }
      });
    });

    // Some existing callers intentionally fire and forget queued work.
    void completion.catch(() => undefined);

    this.latestCompletion = completion;
    if (!this.running) this.run();
    return completion;
  }

  private async run() {
    this.running = true;

    while (this.queue.length) {
      const task = this.queue.shift()!;

      try {
        await task();
      } catch (e) {
        // Don't let a failing task stop the queue processing
        // further tasks. Just log it and move on.
        console.warn('[AsyncQueue] Task failed:', e);
      }
    }

    this.running = false;
  }
}
