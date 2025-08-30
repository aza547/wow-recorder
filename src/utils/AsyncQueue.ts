export default class AsyncQueue {
  private queue: (() => Promise<void>)[] = [];
  private running = false;
  private limit = 1; // Limit the queued tasks.

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
      await task();
    }

    this.running = false;
  }
}
