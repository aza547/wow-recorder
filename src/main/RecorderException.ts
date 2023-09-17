export default class RecorderException extends Error {
  /**
   * Recorder exception constructor. Log is a defaultable argument here
   * as most but not all of the time we want this to log.
   *
   * @param message message to throw with
   * @param log should we log this
   */
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }

  public log() {
    console.error(`[RecorderException] ${this.message}`);
  }
}
