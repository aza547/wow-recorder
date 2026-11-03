import { Flavour, InstantReplayData, RendererVideo } from 'main/types';
import { getAvailableReplay } from 'renderer/rendererutils';
import { VideoCategory } from 'types/VideoCategory';

const saving: InstantReplayData = {
  path: 'buffer/run.mp4',
  category: VideoCategory.MythicPlus,
  deaths: [],
  savedVideoName: 'run - Temple +21',
};

const saved: RendererVideo = {
  category: VideoCategory.MythicPlus,
  flavour: Flavour.Retail,
  result: true,
  duration: 1800,
  overrun: 15,
  combatants: [],
  videoName: 'run - Temple +21',
  videoSource: 'library/run - Temple +21.mp4',
  uniqueId: 'run - Temple +21-disk',
  mtime: 1,
  cloud: false,
  isProtected: false,
  multiPov: [],
};

test('a late click opens the buffer during saving and the local VOD after saving', () => {
  const name = saving.savedVideoName;
  expect(getAvailableReplay(saving, name, [])?.path).toBe(saving.path);
  expect(getAvailableReplay(saving, name, [saved])?.path).toBe(
    saved.videoSource,
  );
  expect(getAvailableReplay(null, name, [saved])?.path).toBe(saved.videoSource);
  expect(
    getAvailableReplay(null, name, [
      { ...saved, cloud: true },
      { ...saved, videoName: 'another key' },
    ]),
  ).toBeNull();
});

test('a new live recording takes priority over the last saved key', () => {
  const live = {
    ...saving,
    path: 'buffer/next.mp4',
    savedVideoName: undefined,
  };
  expect(getAvailableReplay(live, saved.videoName, [saved])).toBe(live);
});
