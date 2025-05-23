import fs from 'fs';
import { EventEmitter } from 'stream';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import {
  CloudMetadata,
  CloudSignedMetadata,
  CompleteMultiPartUploadRequestBody,
  CreateMultiPartUploadResponseBody,
} from 'main/types';
import path from 'path';
import AuthError from '../utils/AuthError';
import { z } from 'zod';
import { Affiliation, TAffiliation } from 'types/api';
import WebSocket from 'ws';

/**
 * A client for retrieving resources from the cloud.
 */
export default class CloudClient extends EventEmitter {
  /**
   * The username of the cloud user.
   */
  private user: string;

  /**
   * The password of the cloud user.
   */
  private pass: string;

  /**
   * The bucket name we're configured to target. Expected to be the name of
   * the guild as configured in the settings.
   */
  private guild: string;

  /**
   * The last modified time of the shared storage.
   */
  private bucketLastMod = 0;

  /**
   * The auth header for the WCR API, which uses basic HTTP auth using the cloud
   * user and password.
   */
  private authHeader: string;

  /**
   * The WCR API endpoint. This is used for authentication, retrieval and
   * manipulation of video state from the video database, and various
   * bits of R2 interaction.
   *
   * Production API: https://api.warcraftrecorder.com/api
   * Development API: https://warcraft-recorder-api-dev.alex-kershaw4.workers.dev/api
   */
  private static api = 'https://api.warcraftrecorder.com/api';

  /**
   * The polling websocket endpoint. This is used to get real-time updates
   * from the WCR API in an efficient manner.
   *
   *  Production API: wss://api.warcraftrecorder.com/poll
   *  Development API: wss://warcraft-recorder-api-dev.alex-kershaw4.workers.dev/poll
   */
  private static poll = 'wss://api.warcraftrecorder.com/poll';

  /**
   * The WCR website, used by the client to build shareable links.
   */
  private static website = 'https://warcraftrecorder.com';

  /**
   * If a file is larger than 4.995GB, we MUST use a multipart approach,
   * else it will be rejected by R2. See https://github.com/aza547/wow-recorder/issues/489
   * and https://developers.cloudflare.com/r2/reference/limits.
   *
   * However, we use a much lower threshold here as it makes retries less painful, in the
   * event of a network failure or similar and we decide to retry, we only need to go back
   * to the start of the current part.
   */
  private multiPartSizeBytes = 100 * 1024 ** 2;

  /**
   * WebSocket connection for real-time updates.
   */
  private ws: WebSocket | null = null;

  /**
   * We don't start polling immediately on creation of this class. This track if
   * startPolling has been called or not.
   */
  private polling = false;

  /**
   * Timer for keeping websocket alive with pings
   */
  private heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Timer for reconnecting the WebSocket connection
   */
  private reconnectTimer: NodeJS.Timeout | null = null;

  /**
   * Constructor.
   */
  constructor(user: string, pass: string, guild: string) {
    super();
    console.info('[CloudClient] Creating cloud client with', user, guild);
    this.user = user;
    this.pass = pass;
    this.guild = guild;
    this.authHeader = CloudClient.createAuthHeader(user, pass);
  }

  /**
   * Return the guild name.
   */
  public getGuildName() {
    return this.guild;
  }

  /**
   * Build the Authorization header string.
   */
  private static createAuthHeader(user: string, pass: string) {
    const authHeaderString = `${user}:${pass}`;
    const encodedAuthString = Buffer.from(authHeaderString).toString('base64');
    return `Basic ${encodedAuthString}`;
  }

  /**
   * Get the video state from the WCR database.
   */
  public async getState(): Promise<CloudSignedMetadata[]> {
    console.info('[CloudClient] Getting video state');

    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/video`;
    const headers = { Authorization: this.authHeader };

    const mtimePromise = this.getMtime();

    const statePromise = axios.get(url, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    const response = await statePromise;

    console.info(
      '[CloudClient] Got video state with',
      response.data.length,
      'videos',
    );

    // Update mtime to avoid multiple refreshes.
    const mtime = await mtimePromise;
    this.bucketLastMod = mtime;

    return response.data;
  }

  /**
   * Add a video to the WCR database.
   */
  public async postVideo(metadata: CloudMetadata) {
    console.info('[CloudClient] Adding video to database', metadata.videoName);

    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/video`;
    const headers = { Authorization: this.authHeader };

    await axios.post(url, metadata, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    // Always run the housekeeper after an upload so that there
    // will be space for the next upload.
    await this.runHousekeeping();

    // Update the mtime to avoid multiple refreshes.
    this.bucketLastMod = Date.now();
    this.emit('change');

    console.info(
      '[CloudClient] Added',
      metadata.videoName,
      'to video database.',
    );
  }

  /**
   * Delete a set of cloud videos. This is a bulk delete operation, but
   * totally valid to call this on one video at a time.
   */
  public async deleteVideos(videoNames: string[]) {
    console.info('[CloudClient] Attempt to delete', videoNames);

    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/bulk/delete`;
    const headers = { Authorization: this.authHeader };

    await axios.post(url, videoNames, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    console.info('[CloudClient] Successfully deleted videos', videoNames);
  }

  /**
   * Protect or unprotect a set of videos.
   */
  public async protectVideos(protect: boolean, videoNames: string[]) {
    console.info(
      `[CloudClient] Attempt to ${protect ? 'protect' : 'unprotect'}`,
      videoNames,
    );

    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/bulk/protect`;
    const headers = { Authorization: this.authHeader };
    const body = { videos: videoNames, protect: protect };

    await axios.post(url, body, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    console.info(
      `[CloudClient] Successfully ${protect ? 'protected' : 'unprotected'}`,
      videoNames,
    );
  }

  /**
   * Tag a video.
   */
  public async tagVideos(tag: string, videoNames: string[]) {
    console.info('[CloudClient] Set tag', tag, 'on', videoNames);

    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/bulk/tag`;
    const headers = { Authorization: this.authHeader };
    const body = { videos: videoNames, tag };

    await axios.post(url, body, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    console.info('[CloudClient] Successfully set tag', tag, 'on', videoNames);
  }

  /**
   * Get an object and write it to a file.
   */
  public async getAsFile(
    key: string,
    url: string,
    dir: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    progressCallback = (_progress: number) => {},
  ) {
    console.info('[CloudClient] Downloading file from cloud store', key);

    const headers = { Authorization: this.authHeader };
    const encGuild = encodeURIComponent(this.guild);
    const encKey = encodeURIComponent(key);

    const sizeUrl = `${CloudClient.api}/guild/${encGuild}/video/${encKey}/size`;

    const sizeRsp = await axios.get(sizeUrl, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    const sizeData = sizeRsp.data;
    const { bytes } = sizeData;

    console.info('[CloudClient] Bytes to download', bytes, 'for key', key);

    const config: AxiosRequestConfig = {
      responseType: 'stream',
      onDownloadProgress: (event) =>
        progressCallback(Math.round((100 * event.loaded) / bytes)),
    };

    // Don't worry about 401s here, this is direct to R2.
    const response = await axios.get(url, config);
    const file = path.join(dir, key);
    const writer = fs.createWriteStream(file);

    const finished = new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    response.data.pipe(writer);
    await finished;
  }

  /**
   * Sign a PUT URL by requesting the WCR API signs it. This is our protection
   * against malicious uploads; the content length is included in the header
   * and the WCR API checks the current bucket usage before approving.
   */
  private async signPutUrl(key: string, bytes: number) {
    console.info('[CloudClient] Getting signed PUT URL', key, bytes);

    const headers = { Authorization: this.authHeader };
    const guild = encodeURIComponent(this.guild);

    const url = `${CloudClient.api}/guild/${guild}/upload`;
    const body = { key, bytes };

    const response = await axios.post(url, body, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    const { data } = response;
    return data.signed;
  }

  /**
   * Create a multi part upload by calling the WCR API to get a list of signed
   * URLs for each part. Once we've uploaded to each URL in turn, must call
   * completeMultiPartUpload.
   */
  private async createMultiPartUpload(
    key: string,
    length: number,
  ): Promise<CreateMultiPartUploadResponseBody> {
    console.info('[CloudClient] Create signed multipart upload', key, length);

    const headers = { Authorization: this.authHeader };
    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/create-multipart-upload`;

    const body = {
      key,
      total: length,
      part: this.multiPartSizeBytes,
    };

    const response = await axios.post(url, body, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    const { data } = response;
    return data;
  }

  /**
   * Complete a multipart upload by calling the WCR API.
   */
  private async completeMultiPartUpload(key: string, etags: string[]) {
    console.info('[CloudClient] Complete signed multipart upload', key);

    const headers = { Authorization: this.authHeader };
    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/complete-multipart-upload`;

    const body: CompleteMultiPartUploadRequestBody = {
      etags,
      key,
    };

    await axios.post(url, body, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });
  }

  /**
   * Write a file into R2.
   *
   * @param file file path to upload
   * @param rate rate of upload in MB/s, or -1 to signify no limit
   */
  public async putFile(
    file: string,
    rate = -1,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    progressCallback = (_progress: number) => {},
  ) {
    const key = path.basename(file);

    console.info(
      '[CloudClient] Uploading',
      file,
      'to',
      key,
      'with rate limit',
      rate,
    );

    const stats = await fs.promises.stat(file);

    if (stats.size < this.multiPartSizeBytes) {
      await this.doSinglePartUpload(file, rate, progressCallback);
    } else {
      await this.doMultiPartUpload(file, rate, progressCallback);
    }
  }

  /**
   * Initialize the bucketLastMod time by reading it from the mtime object in
   * R2. If the mtime object doesn't exist, we will create it.
   */
  public async pollInit() {
    console.info('[CloudClient] Initialize cloud polling');

    try {
      const mtime = await this.getMtime();
      this.bucketLastMod = mtime;
    } catch (error) {
      console.error('[CloudClient] Error getting mtime', String(error));
      throw new Error('Error getting mtime from R2');
    }
  }

  /**
   * Start listening for updates using WebSocket.
   */
  public startPolling() {
    console.info('[CloudClient] Start WebSocket polling');
    
    if (this.polling) {
      return; // Already polling
    }

    this.polling = true;
    this.connectPollingWebsocket();

    // Initialize heartbeat timer
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        this.ws.ping();
      } catch (error) {
        console.warn('[CloudClient] Error sending websocket ping', String(error));
      }
    }, 60 * 1000);

    // Initialize reconnect timer
    this.reconnectTimer = setInterval(() => {
      if (this.ws || !this.polling) {
        return;
      }

      try {
        this.connectPollingWebsocket();
      } catch (error) {
        console.warn('[CloudClient] Error connecting websocket', String(error));
      }
    }, 10000);
  }

  /**
   * Stop listening for updates using WebSocket.
   */
  public stopPolling() {
    console.info('[CloudClient] Stop WebSocket polling');
    this.polling = false;

    // Clean up WebSocket
    if (this.ws) {
      this.ws.removeAllListeners(); // Prevent memory leaks
      this.ws.close();
      this.ws = null;
    }

    // Clean up timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Clean up all resources. Call this before discarding the CloudClient instance.
   */
  public destroy() {
    console.info('[CloudClient] Destroying CloudClient');
    
    // Stop polling (cleans up WebSocket and timers)
    this.stopPolling();
    
    // Clean up EventEmitter listeners
    this.removeAllListeners();
  }

  /**
   * Start listening for updates using WebSocket.
   */
  private connectPollingWebsocket() {
    console.info('[CloudClient] Connecting WebSocket for updates');

    // Clean up existing connection completely
    if (this.ws) {
      this.ws.removeAllListeners(); // Critical for preventing memory leaks
      this.ws.close();
      this.ws = null;
    }

    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.poll}?guild=${guild}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.info('[CloudClient] WebSocket connection established');

      // Once the websocket is open we do a single manual check for
      // updates to make sure we are up to date. After this we can
      // rely on the websocket to notify us of changes.
      this.checkForUpdate();
    });

    this.ws.on('message', (data) => {
      const msg = data.toString();

      if (!msg.includes(':')) {
        // Any message we need to take action on has a colon in it.
        // This is a ping/pong or something else we don't care about.
        return;
      }

      // Messages beyond this point are of the form key:value. For now,
      // we only have mtime messages, but this is a good pattern to follow
      // for extensibility.
      console.info('[CloudClient] Received WebSocket message:', msg);
      const [key, value] = msg.split(':');

      if (key === 'mtime') {
        const mtime = parseInt(value, 10);

        if (mtime > this.bucketLastMod) {
          console.info(
            '[CloudClient] Cloud data changed:',
            mtime,
            this.bucketLastMod,
          );

          this.emit('change');
          this.bucketLastMod = mtime;
        }
      }
    });

    this.ws.on('error', (error) => {
      console.warn('[CloudClient] WebSocket error:', error);
    });

    this.ws.on('close', (code, reason) => {
      console.warn('[CloudClient] WebSocket closed:', code, reason);
      this.ws = null;
    });
  }

  /**
   * Get the total R2 space in use by the guild.
   */
  public async getUsage() {
    console.info('[CloudClient] Get usage from API');

    const headers = { Authorization: this.authHeader };
    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/usage`;

    const response = await axios.get(url, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    const { data } = response;
    const { bytes } = data;
    console.info('[CloudClient] Usage was', bytes);
    return bytes;
  }

  /**
   * Get guild max storage.
   */
  public async getStorageLimit() {
    console.info('[CloudClient] Get storage limit from API');
    const headers = { Authorization: this.authHeader };
    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/limit`;

    const response = await axios.get(url, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    const { data } = response;
    const { bytes } = data;

    console.info('[CloudClient] Storage limit was', bytes);
    return bytes;
  }

  /**
   * Get the guilds the user is affiliated with.
   */
  public async getUserAffiliations(): Promise<TAffiliation[]> {
    return CloudClient.getUserAffiliations(this.user, this.pass);
  }

  /**
   * Static method to get the guilds the user is affiliated with.
   */
  public static async getUserAffiliations(
    user: string,
    pass: string,
  ): Promise<TAffiliation[]> {
    console.info('[CloudClient] Get user affiliations');

    const Authorization = CloudClient.createAuthHeader(user, pass);
    const headers = { Authorization };
    const url = `${CloudClient.api}/user/affiliations`;

    // This is static so we can't emit a logout event.
    const response = await axios.get(url, {
      headers,
      validateStatus: () => true,
    });

    const { status, data } = response;

    if (status === 401 || status === 403) {
      // Special static case, the caller handles any required logouts.
      console.error('[CloudClient] Auth failed:', status, data);

      throw new AuthError(
        'Login to cloud store failed, check your credentials',
      );
    }

    if (status !== 200) {
      console.error(
        '[CloudClient] Failed to get user affiliations',
        status,
        data,
      );

      throw new Error('Failed to get user affiliations');
    }

    const affiliations = z.array(Affiliation).parse(data);
    console.info('[CloudClient] Got user affiliations', affiliations);
    return affiliations;
  }

  /**
   * Call the API to run housekeeping, typically called after a video
   * upload, but theorically safe to call whenever. Logs the result.
   */
  public async runHousekeeping() {
    console.info('[CloudClient] Run housekeeper');

    const headers = { Authorization: this.authHeader };
    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/housekeeper`;

    const response = await axios.post(url, undefined, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    const { data } = response;
    console.info('[CloudClient] Housekeeping results:', data);
  }

  /**
   * Get the mtime object from R2, this keeps track of the most recent
   * modification time to any R2 data.
   */
  private async getMtime(): Promise<number> {
    const headers = { Authorization: this.authHeader };
    const guild = encodeURIComponent(this.guild);
    const url = `${CloudClient.api}/guild/${guild}/mtime`;

    const response = await axios.get(url, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    const { data } = response;
    const { mtime } = data;
    return mtime;
  }

  /**
   * Check if the mtime object in R2 matches what we think it is, if it doesn't
   * we need to trigger a UI refresh.
   */
  private async checkForUpdate() {
    try {
      const mtime = await this.getMtime();

      if (mtime > this.bucketLastMod) {
        console.info(
          '[CloudClient] Cloud data changed:',
          mtime,
          this.bucketLastMod,
        );

        this.emit('change');
        this.bucketLastMod = mtime;
      }
    } catch (error) {
      console.error('[CloudClient] Failed to check for update', String(error));
    }
  }

  /**
   * Get the content type based on the key name. It's good to pass the to
   * R2 as if we set a video content type, a link to it will be played by
   * browsers, rather than just downloading the file.
   */
  private static getContentType(key: string) {
    if (key.endsWith('.mp4')) {
      return 'video/mp4';
    }

    if (key.endsWith('.png')) {
      return 'image/png';
    }

    console.error('[CloudClient] Tried to upload invalid file type', key);
    throw new Error('Tried to upload invalid file type');
  }

  /**
   * Upload a file to S3 in as a single part. Will fail if the file is larger
   * than 10GB.
   */
  private async doSinglePartUpload(
    file: string,
    rate: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    progressCallback = (_progress: number) => {},
  ) {
    const key = path.basename(file);
    const stats = await fs.promises.stat(file);
    const contentType = CloudClient.getContentType(key);

    const config: AxiosRequestConfig = {
      onUploadProgress: (event) =>
        progressCallback(Math.round((100 * event.loaded) / stats.size)),
      headers: { 'Content-Length': stats.size, 'Content-Type': contentType },

      // Without this, we buffer the whole file (which can be several GB)
      // into memory which is just a disaster. This makes me want to pick
      // a different HTTP library. https://github.com/axios/axios/issues/1045.
      maxRedirects: 0,

      // Apply the rate limit here if it's in-play.
      // Convert units from MB/s to bytes per sec.
      maxRate: rate > 0 ? rate * 1024 ** 2 : undefined,
    };

    const signedUrl = await this.signPutUrl(key, stats.size);
    const start = new Date();

    // Retry the upload up to 5 times to allow for network errors, R2
    // errors or anything else intermittent going wrong.
    let attempts = 0;
    let success = false;

    while (!success && attempts < 5) {
      attempts++;
      const stream = fs.createReadStream(file);

      try {
        // Don't worry about 401s here, this is direct to R2.
        await axios.put(signedUrl, stream, config);
        success = true;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;

          console.warn(
            '[CloudClient] Single part retryable failure:',
            key,
            axiosError.message,
          );
        } else {
          console.error('[CloudClient] Not an AxiosError', key, String(error));
        }
      }
    }

    if (!success) {
      console.error('[CloudClient] Failed to upload:', key);
      throw new Error('Retry attempts exhausted');
    }

    const duration = (new Date().valueOf() - start.valueOf()) / 1000;

    console.info(
      '[CloudClient] Single part upload of',
      file,
      `(${stats.size} bytes) took`,
      duration,
      'seconds',
    );
  }

  /**
   * Upload a file to S3 with a multipart approach. Use this method for files
   * larger than 4.995GB as per the Cloudflare docs.
   */
  private async doMultiPartUpload(
    file: string,
    rate: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    progressCallback = (_progress: number) => {},
  ) {
    const key = path.basename(file);
    const stats = await fs.promises.stat(file);
    const contentType = CloudClient.getContentType(key);

    const signedMultipartUpload = await this.createMultiPartUpload(
      key,
      stats.size,
    );

    const start = new Date();
    const { urls } = signedMultipartUpload;

    let offset = 0;
    let remaining = stats.size;

    const numParts = urls.length;
    console.debug('[CloudClient] Multipart upload has', numParts, 'parts');
    const etags: string[] = [];

    // Loop through each of the signed upload URLs, uploading to each in
    // turn. We need to keep track of the etags returned to use when
    // completing the multipart upload.
    for (let part = 0; part < numParts; part++) {
      console.debug('[CloudClient] Starting part', part + 1);

      const url = urls[part];

      const bytes =
        remaining > this.multiPartSizeBytes
          ? this.multiPartSizeBytes
          : remaining;

      const config: AxiosRequestConfig = {
        headers: { 'Content-Length': bytes, 'Content-Type': contentType },
        onUploadProgress: (event) => {
          // This determines the total progress made, accounting for the progress
          // we are through the parts. It falls a bit short on the final part, assuming
          // it's the same size as the others, but it's good enough.
          const previous = 100 * (part / numParts);
          const current = 100 * (event.loaded / bytes);
          const normalized = (1 / numParts) * current;
          const actual = Math.round(previous + normalized);
          progressCallback(actual);
        },

        // Without this, we buffer the whole file (which can be several GB)
        // into memory which is just a disaster. This makes me want to pick
        // a different HTTP library. https://github.com/axios/axios/issues/1045.
        maxRedirects: 0,

        // Apply the rate limit here if it's in-play.
        // Convert units from MB/s to bytes per sec.
        maxRate: rate > 0 ? rate * 1024 ** 2 : undefined,
      };

      // Retry each part upload a few times on failure to allow for
      // intermittent failures the same way we do for single part uploads.
      let attempts = 0;
      let success = false;
      let rsp;

      while (!success && attempts < 5) {
        attempts++;

        const stream = fs.createReadStream(file, {
          start: offset,
          end: offset + bytes - 1,
        });

        try {
          // Don't worry about 401s here, this is direct to R2.
          rsp = await axios.put(url, stream, config);
          success = true;
        } catch (error) {
          // Almost certainly this is an AxiosError.
          if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;

            console.warn(
              '[CloudClient] Multipart retryable failure:',
              key,
              axiosError.message,
            );
          } else {
            console.error(
              '[CloudClient] Not an AxiosError',
              key,
              String(error),
            );
          }
        }
      }

      if (!success || !rsp) {
        console.error('[CloudClient] Multipart upload failed:', key);
        throw new Error('Multipart upload failed, retry attempts exhausted');
      }

      const { headers } = rsp;
      const { etag } = headers;

      if (!etag) {
        console.error('[CloudClient] No etag in response headers', key);
        throw new Error('Multipart upload failed, no etag header');
      }

      // Weirdly axios returns this with quotes included, strip them off.
      const etagNoQuotes = etag.replace(/"/g, '');
      etags.push(etagNoQuotes);

      console.debug(
        '[CloudClient] Finished part',
        part + 1,
        'etag',
        etagNoQuotes,
      );

      // Increment the offset into the file for the next go round the loop.
      offset += bytes;
      remaining -= bytes;

      // Update the progress bar on the frontend. It's a bit worse we only
      // update every time we complete a part here (which are 1GB each), so
      // UX probably a bit worse. Maybe can do better.
      progressCallback(Math.round((100 * offset) / stats.size));
    }

    await this.completeMultiPartUpload(key, etags);
    const duration = (new Date().valueOf() - start.valueOf()) / 1000;

    console.info(
      '[CloudClient] Multipart part upload of',
      file,
      `(${stats.size} bytes) took `,
      duration,
      'seconds',
    );
  }

  /**
   * Get a shareable link for a video.
   */
  public async getShareableLink(videoName: string) {
    console.info('[CloudClient] Getting shareable link', videoName);

    const guild = encodeURIComponent(this.guild);
    const video = encodeURIComponent(videoName);
    const url = `${CloudClient.api}/guild/${guild}/video/${video}/link`;
    const headers = { Authorization: this.authHeader };

    const response = await axios.post(url, undefined, {
      headers,
      validateStatus: (s) => this.validateResponseStatus(s),
    });

    const { id } = response.data;
    console.info('[CloudClient] Got shareable link', videoName, id);
    return `${CloudClient.website}/link/${id}`;
  }

  /**
   * Validate the response status. This is basically just default behaviour plus
   * a check for 401 status codes. If we get a 401, we emit a logout event.
   */
  private validateResponseStatus(status: number) {
    if (status === 401) this.emit('logout');
    return status >= 200 && status < 300;
  }
}
