export class FetchError extends Error {
  public readonly responseCode: Response['status'];
  public readonly responseHeaders: Response['headers'];
  public readonly url: string;

  constructor(url: string, response: Response) {
    super(`FetchError: ${response.status} ${response.statusText}`);
    this.responseCode = response.status;
    this.responseHeaders = response.headers;
    this.url = url;
  }
}
