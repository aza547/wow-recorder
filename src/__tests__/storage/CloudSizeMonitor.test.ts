/* eslint-disable max-classes-per-file */
import { VideoCategory } from '../../types/VideoCategory';
import {
  CloudMetadata,
  CloudObject,
  Flavour,
  IBrowserWindow,
  ICloudClient,
} from '../../main/types';
import CloudSizeMonitor from '../../storage/CloudSizeMonitor';

const getTestCloudMetaData = (name: string, protect: boolean) => {
  const metadata: CloudMetadata = {
    videoName: name,
    videoKey: `${name}.mp4`,
    thumbnailKey: `${name}.png`,
    category: VideoCategory.Clips,
    parentCategory: VideoCategory.Raids,
    duration: 7,
    start: 0,
    result: true,
    flavour: Flavour.Retail,
    zoneID: 0,
    zoneName: 'Unknown Raid',
    encounterID: 2824,
    difficultyID: 16,
    difficulty: 'M',
    player: {
      _GUID: 'Player-3674-09579123',
      _teamID: 0,
      _specID: 62,
      _name: 'Vutar',
      _realm: 'TwistingNether',
    },
    deaths: [],
    encounterName: 'Smolderon',
    protected: protect,
    combatants: [],
    overrun: 15,
    uniqueHash: '636d225211b182acbd979026b42706d9',
  };

  return metadata;
};
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
      lastMod: new Date(Date.now() - 1000),
    },
    {
      key: 'protected.mp4',
      size: 1 * 1024 ** 3,
      lastMod: new Date(Date.now() - 2000),
    },
  ];

  private state: CloudMetadata[] = [
    getTestCloudMetaData('newer', false),
    getTestCloudMetaData('older', false),
    getTestCloudMetaData('protected', true),
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

  public async getState() {
    return this.state;
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
  expect(usage).toBe(301 * 1024 ** 3);
});
