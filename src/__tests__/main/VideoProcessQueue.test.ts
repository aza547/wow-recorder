import path from 'path';
import { once } from 'events';
import VideoProcessQueue from '../../main/VideoProcessQueue';
import CloudClient from '../../storage/CloudClient';
import { send } from '../../main/main';
import { getMetadataForVideo, logAxiosError } from '../../main/util';
import { Flavour, Metadata, UploadQueueItem } from '../../main/types';
import { VideoCategory } from '../../types/VideoCategory';

jest.mock('../../config/ConfigService', () => ({
  __esModule: true,
  default: { getInstance: () => ({ get: () => false }) },
}));
jest.mock('../../utils/configUtils', () => ({}));
jest.mock('../../storage/DiskSizeMonitor', () => ({}));
jest.mock('../../main/Recorder', () => ({}));
jest.mock('storage/DiskClient', () => ({}), { virtual: true });
jest.mock('../../main/main', () => ({ send: jest.fn() }));
jest.mock('../../main/util', () => ({
  fixPathWhenPackaged: (value: string) => value,
  getMetadataForVideo: jest.fn(),
  logAxiosError: jest.fn(),
}));
jest.mock('fluent-ffmpeg', () => ({ setFfmpegPath: jest.fn() }));
jest.mock('../../storage/CloudClient', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({ putFile: mockPutFile, postVideo: mockPostVideo }),
  },
}));

const mockPutFile = jest.fn<
  ReturnType<CloudClient['putFile']>,
  Parameters<CloudClient['putFile']>
>();
const mockPostVideo = jest.fn<
  ReturnType<CloudClient['postVideo']>,
  Parameters<CloudClient['postVideo']>
>();
const mockSend = jest.mocked(send);
const metadata: Metadata = {
  category: VideoCategory.TwoVTwo,
  duration: 60,
  start: 1234,
  result: true,
  flavour: Flavour.Retail,
  combatants: [],
  overrun: 0,
  uniqueHash: 'upload-test',
};
const item = { path: path.join('recordings', 'failed-video.mp4') };
const successMessage = '[VideoProcessQueue] Finished uploading video';
let queue: VideoProcessQueue;
let infoLog: jest.SpyInstance;
let errorLog: jest.SpyInstance;

beforeAll(() => {
  queue = VideoProcessQueue.getInstance();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPutFile.mockReset().mockResolvedValue(undefined);
  mockPostVideo.mockReset().mockResolvedValue(undefined);
  jest.mocked(getMetadataForVideo).mockResolvedValue({ ...metadata });
  infoLog = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  queue['videoQueue'].destroy();
  queue['uploadQueue'].destroy();
  queue['downloadQueue'].destroy();
  queue['killVideoQueue'].destroy();
});

test('Failed transfer reports the filename without completing progress or posting metadata', async () => {
  const error = Object.assign(new Error('Transfer failed'), {
    isAxiosError: true,
  });
  mockPutFile.mockImplementationOnce(async (_path, _limit, onProgress) => {
    onProgress?.(37);
    throw error;
  });
  const done = jest.fn();

  await queue['processUploadQueueItem'](item, done);

  expect(mockSend).toHaveBeenCalledWith('uploadFailed', 'failed-video.mp4');
  expect(mockSend).toHaveBeenCalledWith('updateUploadProgress', 37);
  expect(mockSend).not.toHaveBeenCalledWith('updateUploadProgress', 100);
  expect(mockPostVideo).not.toHaveBeenCalled();
  expect(getMetadataForVideo).not.toHaveBeenCalled();
  expect(logAxiosError).toHaveBeenCalledWith(
    expect.stringContaining('[VideoProcessQueue] Failed to upload video'),
    error,
  );
  expect(jest.mocked(logAxiosError).mock.calls[0][0]).toContain(item.path);
  expect(infoLog).not.toHaveBeenCalledWith(successMessage, item.path);
  expect(done.mock.calls).toEqual([[]]);
});

test('Failed metadata submission reports failure and never logs upload success', async () => {
  const error = new Error('Metadata rejected');
  mockPostVideo.mockRejectedValueOnce(error);
  const done = jest.fn();

  await queue['processUploadQueueItem'](item, done);

  expect(mockSend).toHaveBeenCalledWith('uploadFailed', 'failed-video.mp4');
  expect(mockPostVideo).toHaveBeenCalledWith({
    ...metadata,
    videoName: 'failed-video',
    videoKey: 'failed-video.mp4',
  });
  expect(errorLog.mock.calls[0].map(String).join(' ')).toContain(
    '[VideoProcessQueue] Failed to upload video',
  );
  expect(errorLog.mock.calls[0].map(String).join(' ')).toContain(item.path);
  expect(errorLog.mock.calls[0]).toContain(error);
  expect(infoLog).not.toHaveBeenCalledWith(successMessage, item.path);
  expect(done.mock.calls).toEqual([[]]);
});

test('Upload success is logged only after metadata submission completes', async () => {
  let completeMetadata!: () => void;
  let metadataStarted!: () => void;
  const metadataSaved = new Promise<void>((resolve) => {
    completeMetadata = resolve;
  });
  const started = new Promise<void>((resolve) => {
    metadataStarted = resolve;
  });
  mockPostVideo.mockImplementationOnce(() => {
    metadataStarted();
    return metadataSaved;
  });
  const done = jest.fn();
  const uploading = queue['processUploadQueueItem'](item, done);

  await started;
  expect(infoLog).not.toHaveBeenCalledWith(successMessage, item.path);
  expect(done).not.toHaveBeenCalled();
  completeMetadata();
  await uploading;

  expect(infoLog).toHaveBeenCalledWith(successMessage, item.path);
  expect(mockSend).not.toHaveBeenCalledWith('uploadFailed', expect.anything());
  expect(mockSend).toHaveBeenCalledWith('updateUploadProgress', 100);
  expect(done.mock.calls).toEqual([[]]);
});

test('The real upload queue continues after failure and permits retrying the same path', async () => {
  const next = { path: path.join('recordings', 'next-video.mp4') };
  mockPutFile.mockRejectedValueOnce(new Error('Transfer failed'));
  const nextFinished = new Promise<void>((resolve) => {
    const onFinish = (_output: unknown, uploaded: UploadQueueItem) => {
      if (uploaded.path === next.path) {
        queue['uploadQueue'].pool.removeListener('finish', onFinish);
        resolve();
      }
    };
    queue['uploadQueue'].pool.on('finish', onFinish);
  });

  await queue.queueUpload(item);
  await queue.queueUpload(next);
  await nextFinished;

  expect(queue['inProgressUploads']).toEqual([]);
  expect(mockPutFile.mock.calls.map(([videoPath]) => videoPath)).toEqual([
    item.path,
    next.path,
  ]);
  expect(mockPostVideo).toHaveBeenCalledTimes(1);
  expect(mockPostVideo).toHaveBeenCalledWith(
    expect.objectContaining({ videoKey: 'next-video.mp4' }),
  );
  expect(infoLog).not.toHaveBeenCalledWith(successMessage, item.path);
  expect(infoLog).toHaveBeenCalledWith(successMessage, next.path);
  expect(mockSend).toHaveBeenCalledWith('uploadFailed', 'failed-video.mp4');
  expect(mockSend).toHaveBeenLastCalledWith('updateUploadQueueLength', 0);

  const retried = once(queue['uploadQueue'].pool, 'finish');
  await queue.queueUpload(item);
  await retried;

  expect(mockPutFile).toHaveBeenCalledTimes(3);
  expect(mockPostVideo).toHaveBeenCalledTimes(2);
  expect(queue['inProgressUploads']).toEqual([]);
  expect(infoLog).toHaveBeenCalledWith(successMessage, item.path);
  expect(
    mockSend.mock.calls.filter(([channel]) => channel === 'uploadFailed'),
  ).toEqual([['uploadFailed', 'failed-video.mp4']]);
});
