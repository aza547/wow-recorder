/* eslint-disable max-classes-per-file */
import { CloudObject, IBrowserWindow, ICloudClient } from '../../main/types';
import CloudSizeMonitor from '../../storage/CloudSizeMonitor';

/**
 * Test implementation of the Cloud Client to do the bare minimum required
 * for the size monitor run.
 */
class TestCloudClient implements ICloudClient {
  private objects: CloudObject[] = [
    {
      key: 'newer.mp4',
      size: 150 * 1024 ** 3,
      lastMod: new Date(),
    },
    {
      key: 'older.mp4',
      size: 150 * 1024 ** 3,
      lastMod: new Date(Date.now() - 60000),
    },
  ];

  public deletedObjects: string[] = [];

  public deletedRows: string[] = [];

  public async list() {
    return this.objects;
  }

  public async delete(key: string) {
    this.deletedObjects.push(key);
  }

  public async deleteVideo(videoName: string) {
    this.deletedRows.push(videoName);
  }
}

/**
 * Test implemenation of the main window as required by the CloudSizeMonitor
 * to trigger a refresh.
 */
class TestBrowserWindow implements IBrowserWindow {
  public webContents = {
    refreshCount: 0,
    send(channel: string) {
      if (channel === 'refreshState') this.refreshCount++;
    },
  };
}

/**
 * Test the size monitor runs and deletes an older video from a list of two when
 * the size limit is exceeded.
 */
test('Run', async () => {
  const mainWindow = new TestBrowserWindow();
  const cloudClient = new TestCloudClient();

  const sizeMonitor = new CloudSizeMonitor(mainWindow, cloudClient, 250);
  await sizeMonitor.run();

  const { deletedObjects, deletedRows } = cloudClient;
  const expectedDeletedObjects = ['older.mp4', 'older.png'];
  const expectedDeletedRows = ['older'];
  const refreshes = mainWindow.webContents.refreshCount;

  expect(deletedObjects).toStrictEqual(expectedDeletedObjects);
  expect(deletedRows).toStrictEqual(expectedDeletedRows);
  expect(refreshes).toBe(1);
});

/**
 * Test the size monitor runs and deletes an older video from a list of two when
 * the size limit is exceeded.
 */
test('Usage', async () => {
  const mainWindow = new TestBrowserWindow();
  const cloudClient = new TestCloudClient();

  const sizeMonitor = new CloudSizeMonitor(mainWindow, cloudClient, 250);
  const usage = await sizeMonitor.usage();
  expect(usage).toBe(300 * 1024 ** 3);
});
