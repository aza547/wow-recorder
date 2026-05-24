/** @jest-environment jsdom */

import React from 'react';
import { render } from '@testing-library/react';
import {
  AppState,
  Flavour,
  Pages,
  RendererVideo,
  StorageFilter,
} from '../../main/types';
import { VideoCategory } from '../../types/VideoCategory';
import { Language } from '../../localisation/translations';
import CategoryPage from '../../renderer/CategoryPage';

let mockResizableEnable: unknown;
let mockResizableOnResizeStart:
  | ((
      event: React.MouseEvent<HTMLDivElement>,
      direction: string,
      element: HTMLDivElement,
    ) => boolean | void)
  | undefined;

jest.mock('re-resizable', () => {
  const React = require('react');

  const MockResizable = React.forwardRef(
    (
      props: {
        enable?: unknown;
        onResizeStart?: typeof mockResizableOnResizeStart;
        children?: React.ReactNode;
      },
      ref: React.Ref<unknown>,
    ) => {
      mockResizableEnable = props.enable;
      mockResizableOnResizeStart = props.onResizeStart;
      React.useImperativeHandle(ref, () => ({ updateSize: jest.fn() }));
      return <div data-testid="resizable">{props.children}</div>;
    },
  );

  MockResizable.displayName = 'MockResizable';

  return {
    Resizable: MockResizable,
  };
});

jest.mock('../../renderer/VideoPlayer', () => {
  const React = require('react');

  const MockVideoPlayer = React.forwardRef(() => (
    <div data-testid="video-player" />
  ));

  MockVideoPlayer.displayName = 'MockVideoPlayer';

  return {
    __esModule: true,
    default: MockVideoPlayer,
  };
});

jest.mock('../../renderer/useSettings', () => ({
  useSettings: () => [
    {
      cloudStorage: false,
      cloudUpload: false,
      cloudAccountName: '',
      chatUserNameAgreed: '',
    },
    jest.fn(),
  ],
}));

jest.mock('../../renderer/VideoCorrelator', () => ({
  __esModule: true,
  default: {
    correlate: (videos: RendererVideo[]) => videos,
  },
}));

jest.mock('../../renderer/VideoFilter', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    filter: () => true,
  })),
}));

jest.mock('../../renderer/components/Tables/TableData', () => ({
  __esModule: true,
  default: () => ({
    getSelectedRowModel: () => ({ rows: [] }),
  }),
}));

jest.mock('../../renderer/components/Tables/VideoSelectionTable', () => ({
  __esModule: true,
  default: () => <div data-testid="video-selection-table" />,
}));

jest.mock('../../renderer/MultiPovPlaybackToggles', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../../renderer/VideoMarkerToggles', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../../renderer/SearchBar', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../../renderer/DateRangePicker', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../../renderer/StorageFilterToggle', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../../renderer/components/Viewpoints/ViewpointSelection', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../../renderer/DeleteDialog', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../renderer/BulkTransferDialog', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../renderer/VideoChat', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../../renderer/ConfirmChatNamePrompt', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../../renderer/components/Tooltip/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const video: RendererVideo = {
  category: VideoCategory.Raids,
  duration: 100,
  result: true,
  flavour: Flavour.Retail,
  combatants: [],
  overrun: 0,
  videoName: 'raid.mp4',
  mtime: 1,
  videoSource: 'raid.mp4',
  isProtected: false,
  cloud: false,
  multiPov: [],
  uniqueId: 'raid-disk',
};

const appState: AppState = {
  page: Pages.None,
  category: VideoCategory.Raids,
  selectedVideos: [],
  multiPlayerMode: false,
  viewpointSelectionOpen: false,
  videoFilterTags: [],
  dateRangeFilter: null,
  storageFilter: StorageFilter.BOTH,
  videoFullScreen: false,
  playing: false,
  language: Language.ENGLISH,
  cloudStatus: {
    enabled: false,
    authenticated: false,
    authorized: false,
    guild: '',
    available: [],
    read: true,
    write: false,
    del: false,
    usage: 0,
    limit: 0,
  },
  diskStatus: {
    usage: 0,
    limit: 0,
  },
  chatOpen: false,
  preferredViewpoint: '',
};

test('video player can only be resized from the bottom handle', () => {
  render(
    <CategoryPage
      category={VideoCategory.Raids}
      videoState={[video]}
      setVideoState={jest.fn()}
      appState={appState}
      setAppState={jest.fn()}
      persistentProgress={{ current: 0 }}
      playerHeight={{ current: 500 }}
    />,
  );

  expect(mockResizableEnable).toEqual({
    top: false,
    right: false,
    bottom: true,
    left: false,
    topRight: false,
    bottomRight: false,
    bottomLeft: false,
    topLeft: false,
  });
});

test('player resize start rejects non-bottom handles', () => {
  render(
    <CategoryPage
      category={VideoCategory.Raids}
      videoState={[video]}
      setVideoState={jest.fn()}
      appState={appState}
      setAppState={jest.fn()}
      persistentProgress={{ current: 0 }}
      playerHeight={{ current: 500 }}
    />,
  );

  expect(mockResizableOnResizeStart).toBeDefined();

  const event = {} as React.MouseEvent<HTMLDivElement>;
  const element = document.createElement('div');

  [
    'top',
    'right',
    'left',
    'topRight',
    'bottomRight',
    'bottomLeft',
    'topLeft',
  ].forEach((direction) => {
    expect(mockResizableOnResizeStart?.(event, direction, element)).toBe(false);
  });

  expect(mockResizableOnResizeStart?.(event, 'bottom', element)).not.toBe(
    false,
  );
});
