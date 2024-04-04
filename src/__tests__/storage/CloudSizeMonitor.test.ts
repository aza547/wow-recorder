/* eslint-disable class-methods-use-this */
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

  public deleted: string[] = [];

  public async list() {
    return this.objects;
  }

  public async delete(key: string) {
    this.deleted.push(key);
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

  const sizeMonitor = new CloudSizeMonitor(mainWindow, cloudClient, 200);
  await sizeMonitor.run();

  const { deleted } = cloudClient;
  const expected = ['older.mp4', 'older.png', 'older.json'];
  const refreshes = mainWindow.webContents.refreshCount;

  expect(deleted).toStrictEqual(expected);
  expect(refreshes).toBe(1);
});
