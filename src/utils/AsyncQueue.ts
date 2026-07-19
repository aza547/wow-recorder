export default class AsyncQueue {
  private queue: (() => Promise<void>)[] = [];
  private running = false;
  private limit: number; // Limit the queued tasks.

  constructor(limit: number) {
    this.limit = limit;
  }

  public add(task: () => Promise<void>) {
    // Just drop any tasks added over the limit.
    if (this.queue.length >= this.limit) return;
    this.queue.push(task);
    if (!this.running) this.run();
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
