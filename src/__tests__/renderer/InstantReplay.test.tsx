/** @jest-environment jsdom */
import { act, ComponentProps, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AppState,
  CombatLoggingStatus,
  InstantReplayState,
  MicStatus,
  Pages,
  RecStatus,
  SaveStatus,
} from 'main/types';
import { ConfigurationSchema } from 'config/configSchema';
import { VideoCategory } from 'types/VideoCategory';
import { Language } from 'localisation/translations';

jest.mock('renderer/useSettings', () => ({}));
jest.mock('renderer/TestButton', () => () => null);
jest.mock('renderer/DiscordButton', () => () => null);
jest.mock('renderer/PatreonButton', () => () => null);
jest.mock('renderer/DiagnosticsDialog', () => () => null);
jest.mock(
  'renderer/containers/UpdateNotifier/UpdateNotifier',
  () => () => null,
);
jest.mock(
  'renderer/containers/ApplicationStatusCard/ApplicationStatusCard',
  () => () => null,
);
jest.mock(
  'renderer/containers/ApplicationStatusCard/CloudStatusCard',
  () => () => null,
);
jest.mock('renderer/components/Tooltip/Tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('renderer/components/ScrollArea/ScrollArea', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => children,
}));

Object.defineProperty(window, 'electron', {
  value: { ipcRenderer: { on: jest.fn() } },
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const SideMenu = require('renderer/SideMenu')
  .default as typeof import('renderer/SideMenu').default;

test('a late replay click works during saving and is disabled when saving finishes', () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const replay = {
    path: 'buffer/run.mp4',
    category: VideoCategory.MythicPlus,
    deaths: [],
  };
  let state: InstantReplayState = { current: replay, open: null };
  const setAppState = jest.fn();
  const props: ComponentProps<typeof SideMenu> = {
    config: {} as ConfigurationSchema,
    videoCounters: Object.fromEntries(
      Object.values(VideoCategory).map((category) => [category, 0]),
    ) as Record<VideoCategory, number>,
    appState: {
      language: Language.ENGLISH,
      category: VideoCategory.MythicPlus,
      page: Pages.None,
    } as AppState,
    recorderStatus: RecStatus.ReadyToRecord,
    savingStatus: SaveStatus.Saving,
    micStatus: MicStatus.NONE,
    error: '',
    errorReports: [],
    updateAvailable: false,
    recorderCategory: undefined,
    activityStatus: null,
    combatLoggingStatus: {} as CombatLoggingStatus,
    setPreviewEnabled: jest.fn(),
    instantReplayState: state,
    persistentProgressRef: { current: 0 },
    setAppState,
    setInstantReplayState: (update) => {
      state = typeof update === 'function' ? update(state) : update;
    },
  };
  const render = () =>
    act(() => root.render(<SideMenu {...props} instantReplayState={state} />));
  const button = () =>
    Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find(
      (item) => item.textContent?.trim() === 'Instant Replay',
    )!;

  render();
  expect(button().querySelector('.animate-pulse')).not.toBeNull();
  act(() => button().click());
  expect(state.open).toBe(replay);

  state = { ...state, current: null };
  props.appState.page = Pages.InstantReplay;
  render();
  expect(button().querySelector('.animate-pulse')).toBeNull();
  expect(button().classList.contains('cursor-not-allowed')).toBe(true);
  expect(state.open).toBe(replay);

  props.appState.page = Pages.None;
  render();
  setAppState.mockClear();
  act(() => button().click());
  expect(setAppState).not.toHaveBeenCalled();
  act(() => root.unmount());
});
