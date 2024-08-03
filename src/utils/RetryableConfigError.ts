export default class RetryableConfigError extends Error {
  /**
   * Length of time to wait before retrying, in milliseconds.
   */
  public time: number;

  constructor(message: string, time: number) {
    super(message);
    this.name = 'RetryableConfigError';
    this.time = time;
  }
}
