import fs from 'fs';
import { EventEmitter } from 'stream';
import axios, { AxiosRequestConfig } from 'axios';
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import assert from 'assert';
import { CloudObject, ICloudClient } from 'main/types';
import path from 'path';

/**
 * A client for retrieving resources from the cloud.
 */
export default class CloudClient extends EventEmitter implements ICloudClient {
  /**
   * The bucket name we're configured to target. Expected to be the name of
   * the guild as configured in the settings.
   */
  private bucket: string;

  /**
   * The last modified time of the bucket as per the mtime object. This is
   * to avoid needing to do multiple list operations on the bucket to determine
   * if anything has changed, a get on a single object is much cheaper.
   */
  private bucketLastMod = '0';

  /**
   * The read only S3 client. This is setup by the init function which needs to
   * be async as it gets read only credentials from the WR API.
   */
  private S3: S3Client | undefined;

  /**
   * The auth header for the WR API, which uses basic HTTP auth using the cloud
   * user and password.
   */
  private authHeader: string;

  /**
   * Timer for checking the cloud store for updates.
   */
  private pollTimer: NodeJS.Timer | undefined;

  /**
   * The WR API endpoint. This is used for authenticating the user to provide read
   * only S3 credentials on startup, to provide signed URLs for uploads and also
   * handles deletes and mtime updates directly.
   */
  private apiEndpoint =
    'https://warcraft-recorder-worker.alex-kershaw4.workers.dev';

  /**
   * The Cloudflare R2 endpoint, this is an S3 compatible API.
   */
  private s3Endpoint =
    'https://c5952c10f79c8369edb2ef256ef3d337.r2.cloudflarestorage.com/';

  /**
   * Constructor.
   */
  constructor(user: string, pass: string, bucket: string) {
    super();
    console.info('[CloudClient] Creating cloud client with', user, bucket);
    this.bucket = bucket;
    this.authHeader = CloudClient.createAuthHeader(user, pass);
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
   * Initialize the S3 client. This should always be called immediately after
   * calling the constructor.
   */
  public async init() {
    console.info('[CloudClient] Initializing the cloud client');

    const headers = { Authorization: this.authHeader };
    const encbucket = encodeURIComponent(this.bucket);

    const response = await axios.get(`${this.apiEndpoint}/${encbucket}/keys`, {
      headers,
      validateStatus: () => true,
    });

    const { status, data } = response;

    if (status === 401) {
      console.error('[CloudClient] 401 response from worker', data);
      throw new Error('Login to cloud store failed, check your credentials');
    }

    if (status !== 200) {
      console.error('[CloudClient] Failure response from worker', status, data);
      throw new Error('Error logging into cloud store');
    }

    this.S3 = new S3Client({
      region: 'auto',
      endpoint: this.s3Endpoint,
      credentials: {
        accessKeyId: data.access,
        secretAccessKey: data.secret,
      },
    });
  }

  /**
   * List all the objects in the bucket. This should be called sparingly as
   * it's the most expensive bucket operation. Returns a custom type as we
   * don't want the AWS types passed up the stack further than this class.
   */
  public async list(): Promise<CloudObject[]> {
    console.info('[CloudClient] Listing all objects in R2.');
    const start = new Date();
    assert(this.S3);

    const cloudObjects: CloudObject[] = [];
    let continuationToken;

    do {
      const params: ListObjectsV2CommandInput = {
        Bucket: this.bucket,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      };

      const cmd = new ListObjectsV2Command(params);
      // eslint-disable-next-line no-await-in-loop
      const rsp = await this.S3.send(cmd);

      const objects = rsp.Contents;
      continuationToken = rsp.NextContinuationToken;

      if (!objects) {
        return cloudObjects;
      }

      objects.forEach((obj) => {
        const key = obj.Key;
        const size = obj.Size;
        const lastMod = obj.LastModified;

        if (key === undefined || size === undefined || lastMod === undefined) {
          return;
        }

        const cloudObject: CloudObject = { key, size, lastMod };
        cloudObjects.push(cloudObject);
      });
    } while (continuationToken);

    const duration = (new Date().valueOf() - start.valueOf()) / 1000;

    console.info(
      '[CloudClient] List of',
      cloudObjects.length,
      'R2 objects took',
      duration,
      'sec.'
    );

    return cloudObjects;
  }

  /**
   * Get an object as a string.
   */
  public async getAsString(key: string) {
    assert(this.S3);

    const params = { Bucket: this.bucket, Key: key };
    const cmd = new GetObjectCommand(params);
    const rsp = await this.S3.send(cmd);
    const { Body } = rsp;

    if (!Body) {
      return '';
    }

    return Body.transformToString();
  }

  /**
   * Get an object and write it to a file.
   */
  public async getAsFile(
    key: string,
    dir: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    progressCallback = (_progress: number) => {}
  ) {
    assert(this.S3);
    console.info('[CloudClient] Downloading file from cloud store', key, dir);

    const signedUrl = await this.signGetUrl(key, 3600);
    const head = await this.head(key);
    const size = head.size || 1;

    const config: AxiosRequestConfig = {
      responseType: 'stream',
      onDownloadProgress: (event) =>
        progressCallback(Math.round((100 * event.loaded) / size)),
    };

    const response = await axios.get(signedUrl, config);
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
   * Sign a PUT URL by requesting the WR API signs it. This is our protection
   * against malicious uploads; the content length is included in the header
   * and the WR API checks the current bucket usage before approving.
   */
  private async signPutUrl(key: string, length: number) {
    console.info('[CloudClient] Getting signed PUT URL', key, length);

    const headers = { Authorization: this.authHeader };
    const encbucket = encodeURIComponent(this.bucket);
    const enckey = encodeURIComponent(key);
    const url = `${this.apiEndpoint}/${encbucket}/upload/${enckey}/${length}`;

    const response = await axios.get(url, {
      headers,
      validateStatus: () => true,
    });

    const { status, data } = response;

    if (status !== 200) {
      console.error(
        '[CloudClient] Failed to get signed upload request',
        response.status,
        response.data
      );

      throw new Error('Failed to get signed upload request');
    }

    return data.signed;
  }

  /**
   * Write a JSON string into R2.
   */
  public async putJsonString(str: string, key: string) {
    console.info('[CloudClient] PUT JSON string', key);

    // Must convert to a UTF-8 to avoid encoding shenanigans here with
    // handling special characters.
    const buffer = Buffer.from(str, 'utf-8');
    const signedUrl = await this.signPutUrl(key, buffer.length);

    const rsp = await axios.put(signedUrl, buffer, {
      headers: {
        'Content-Length': buffer.length,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });

    const { status, data } = rsp;

    if (status >= 400) {
      console.error('[CloudClient] JSON upload failed', key, status, data);
      throw new Error('Uploading a JSON string to the cloud failed');
    }

    await this.updateLastMod();
  }

  /**
   * Write a file into R2.
   */
  public async putFile(
    file: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    progressCallback = (_progress: number) => {}
  ) {
    console.error('[CloudClient] Uploading', file);
    const key = path.basename(file);
    const stats = await fs.promises.stat(file);
    const stream = fs.createReadStream(file);
    let contentType;

    if (key.endsWith('.mp4')) {
      contentType = 'video/mp4';
    } else if (key.endsWith('.json')) {
      contentType = 'application/json';
    } else if (key.endsWith('.png')) {
      contentType = 'image/png';
    } else {
      console.error('[CloudClient] Tried to upload invalid file type', key);
      throw new Error('Tried to upload invalid file type');
    }

    const config: AxiosRequestConfig = {
      onUploadProgress: (event) =>
        progressCallback(Math.round((100 * event.loaded) / stats.size)),
      headers: { 'Content-Length': stats.size, 'Content-Type': contentType },
      validateStatus: () => true,

      // Without this, we buffer the whole file (which can be several GB)
      // into memory which is just a disaster. This makes me want to pick
      // a different HTTP library. https://github.com/axios/axios/issues/1045.
      maxRedirects: 0,
    };

    const signedUrl = await this.signPutUrl(key, stats.size);
    const start = new Date();
    const rsp = await axios.put(signedUrl, stream, config);
    const { status, data } = rsp;

    if (status >= 400) {
      console.error('[CloudClient] File upload failed', key, status, data);
      throw new Error('Uploading a file to the cloud failed');
    }

    console.info('[Cloud Client] Upload status:', rsp.status);
    const duration = (new Date().valueOf() - start.valueOf()) / 1000;

    console.info(
      '[CloudClient] Upload of',
      file,
      `(${stats.size} bytes) took `,
      duration,
      'seconds'
    );

    await this.updateLastMod();
  }

  /**
   * Sign a GET URL, this is all done client side. We have read only
   * access keys.
   */
  public async signGetUrl(key: string, expiry: number) {
    assert(this.S3);
    const req = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.S3, req, { expiresIn: expiry });
  }

  /**
   * Head an object, making a request directly to R2.
   */
  public async head(key: string): Promise<CloudObject> {
    assert(this.S3);

    const params = { Bucket: this.bucket, Key: key };
    const cmd = new HeadObjectCommand(params);
    const data = await this.S3.send(cmd);

    const object: CloudObject = {
      key,
      size: data.ContentLength || 0,
      lastMod: data.LastModified || new Date(0),
    };

    return object;
  }

  /**
   * Delete an object via the WR API.
   */
  public async delete(key: string) {
    console.info('[Cloud Client] Deleting', key);
    const headers = { Authorization: this.authHeader };
    const encbucket = encodeURIComponent(this.bucket);
    const enckey = encodeURIComponent(key);
    const url = `${this.apiEndpoint}/${encbucket}/${enckey}`;
    await axios.delete(url, { headers });
    console.info('[Cloud Client] Deleted', key);
    await this.updateLastMod();
  }

  /**
   * Initialize the bucketLastMod time by reading it from the mtime object in
   * R2. If the mtime object doesn't exist, we will create it.
   */
  public async pollInit() {
    console.info('[CloudClient] Poll init');

    try {
      const mtime = await this.getAsString('mtime');
      this.bucketLastMod = mtime;
    } catch (error) {
      if (String(error).includes('NoSuchKey')) {
        console.info('[CloudClient] Hit NoSuchKey, mtime will be created');
        await this.updateLastMod();
      } else {
        console.error('[CloudClient] Error getting mtime', String(error));
        throw new Error('Error getting mtime from R2');
      }
    }
  }

  /**
   * Set a timer to poll for updates.
   */
  public pollForUpdates(sec: number) {
    console.info('[CloudClient] Start polling for updates');
    this.stopPollForUpdates();

    this.pollTimer = setInterval(() => {
      this.checkForUpdate();
    }, sec * 1000);
  }

  /**
   * Clear the polling timer.
   */
  public stopPollForUpdates() {
    console.info('[CloudClient] Stop polling for updates');

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  /**
   * Check if the mtime object in R2 matches what we think it is, if it doesn't
   * we need to trigger a UI refresh.
   */
  private async checkForUpdate() {
    const mtime = await this.getAsString('mtime');

    if (mtime === this.bucketLastMod) {
      return;
    }

    console.info('[CloudClient] Cloud data changed');
    this.emit('change');
    this.bucketLastMod = mtime;
  }

  /**
   * Update the mtime object in R2 to reflect the most recent mod time, typically
   * should call this whenever you update an object to trigger other clients to
   * refresh.
   */
  private async updateLastMod() {
    const mtime = new Date().getTime().toString();
    console.info('[CloudClient] Updating last mod time to', mtime);
    this.bucketLastMod = mtime;
    const encbucket = encodeURIComponent(this.bucket);
    const url = `${this.apiEndpoint}/${encbucket}/mtime/${mtime}`;
    const headers = { Authorization: this.authHeader };
    await axios.post(url, undefined, { headers });
  }
}
