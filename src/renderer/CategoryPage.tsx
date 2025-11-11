import * as React from 'react';
import { AppState, RendererVideo } from 'main/types';
import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  GripHorizontal,
  LockKeyhole,
  Trash,
  LockOpen,
  CloudUpload,
  CloudDownload,
  ArrowLeftFromLine,
  ArrowRightToLine,
  Cloud,
  Clapperboard,
} from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { VideoCategory } from '../types/VideoCategory';
import SearchBar from './SearchBar';
import VideoMarkerToggles from './VideoMarkerToggles';
import { useSettings } from './useSettings';
import {
  getVideoCategoryFilter,
  getVideoStorageFilter,
  povDiskFirstNameSort,
} from './rendererutils';
import Separator from './components/Separator/Separator';
import { Button } from './components/Button/Button';
import VideoSelectionTable from './components/Tables/VideoSelectionTable';
import DeleteDialog from './DeleteDialog';
import MultiPovPlaybackToggles from './MultiPovPlaybackToggles';
import VideoFilter from './VideoFilter';
import { Resizable, ResizeCallback } from 're-resizable';
import { Direction } from 're-resizable/lib/resizer';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import Label from './components/Label/Label';
import ViewpointSelection from './components/Viewpoints/ViewpointSelection';
import useTable from './components/Tables/TableData';
import { Tooltip } from './components/Tooltip/Tooltip';
import DateRangePicker from './DateRangePicker';
import StorageFilterToggle from './StorageFilterToggle';
import VideoCorrelator from './VideoCorrelator';
import { Phrase } from 'localisation/phrases';
import BulkTransferDialog from './BulkTransferDialog';
import VideoChat from './VideoChat';
import ConfirmChatNamePrompt from './ConfirmChatNamePrompt';

interface IProps {
  category: VideoCategory;
  videoState: RendererVideo[];
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>;
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  playerHeight: MutableRefObject<number>;
}

/**
 * A page representing a video category.
 */
const CategoryPage = (props: IProps) => {
  const {
    category,
    videoState,
    setVideoState,
    appState,
    setAppState,
    persistentProgress,
    playerHeight,
  } = props;

  const {
    selectedVideos,
    videoFilterTags,
    language,
    dateRangeFilter,
    cloudStatus,
    storageFilter,
    chatOpen,
  } = appState;

  const { write, del } = cloudStatus;
  const [config, setConfig] = useSettings();

  // The category state, recalculated only when required.
  const categoryState = useMemo<RendererVideo[]>(() => {
    const categoryFilter = getVideoCategoryFilter(category);
    return videoState.filter(categoryFilter);
  }, [videoState, category]);

  // Filter by storage type before we apply grouping.
  const correlatedState = useMemo<RendererVideo[]>(() => {
    const storageFilterFn = getVideoStorageFilter(storageFilter);
    const storageFilteredState = categoryState.filter(storageFilterFn);
    return VideoCorrelator.correlate(storageFilteredState);
  }, [categoryState, storageFilter]);

  // Now apply filtering based on search tags and date range.
  const filteredState = useMemo<RendererVideo[]>(() => {
    const queryFilter = (rv: RendererVideo) =>
      new VideoFilter(rv, videoFilterTags, dateRangeFilter, language).filter();
    return correlatedState.filter(queryFilter);
  }, [correlatedState, dateRangeFilter, videoFilterTags, language]);

  // The data backing the video selection table.
  const table = useTable(filteredState, appState, setVideoState);

  const haveVideos = categoryState.length > 0;
  const isClips = category === VideoCategory.Clips;

  // Handle to reset the video player height.
  const resizableRef = useRef<Resizable>(null);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  useEffect(() => {
    const handleWindowResize = () => {
      if (!resizableRef.current) {
        // Could on only happen if we're resizing in the
        // middle of the initial mount.
        return;
      }

      // 96px = 32 (top bar) + 40 (video controls) + 24 (grip)
      if (playerHeight.current + 96 > window.innerHeight) {
        // The video is bigger than the window. Reset it
        // to the original size. Could probably check that
        // 500 is smaller than the window but who resizes
        // their window to be smaller than 500px?
        resizableRef.current.updateSize({ height: 500 });
        playerHeight.current = 500;
      }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [playerHeight]);

  const renderChat = (video: RendererVideo | undefined) => {
    if (category === VideoCategory.Clips) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-foreground text-sm font-bold">
          <Clapperboard size={35} className="mb-2" />
          {getLocalePhrase(language, Phrase.ChatForClipsComingSoon)}
        </div>
      );
    }

    if (!video) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-foreground text-sm font-bold">
          <Cloud size={35} className="mb-2" />
          {getLocalePhrase(language, Phrase.ChatUploadToCloudText)}
        </div>
      );
    }

    if (config.cloudAccountName !== config.chatUserNameAgreed) {
      return (
        <ConfirmChatNamePrompt
          cloudAccountName={config.cloudAccountName}
          setConfig={setConfig}
          language={language}
        />
      );
    }

    return (
      <VideoChat
        key={video.videoName}
        videoPlayerRef={videoPlayerRef}
        video={video}
        language={language}
      />
    );
  };

  /**
   * Handle a resize event.
   */
  const onResize: ResizeCallback = (
    event: MouseEvent | TouchEvent,
    direction: Direction,
    element: HTMLElement,
  ) => {
    const height = element.clientHeight;
    playerHeight.current = height;
  };

  const renderDrawerOpen = () => {
    // Only the first row in the selection is relevant for the drawer display.
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedRow = selectedRows[0];

    const activeParentVideo = selectedRow
      ? selectedRow.original
      : filteredState[0];

    // Only try to find a chat video if we have a video with cloud storage,
    // a start time and a hash, else we cannot find the chat correlator.
    const chatVideo = [activeParentVideo, ...activeParentVideo.multiPov].find(
      (rv) => rv.cloud && rv.uniqueHash && rv.start,
    );

    return (
      <div className="max-w-[500px] min-w-[500px] h-full bg-background-higher flex flex-col mx-2 gap-y-2">
        <div className="flex items-start">
          <Button
            onClick={() =>
              setAppState((prev) => ({ ...prev, chatOpen: false }))
            }
            variant="ghost"
            className="mt-2"
            size="xs"
          >
            <ArrowRightToLine size={18} />
          </Button>
        </div>
        <div className="flex items-center justify-center w-full">
          <ViewpointSelection
            video={activeParentVideo}
            appState={appState}
            setAppState={setAppState}
            persistentProgress={persistentProgress}
          />
        </div>
        {renderChat(chatVideo)}
      </div>
    );
  };

  const renderDrawerClosed = () => {
    return (
      <div className="h-full relative">
        <Button
          onClick={() => setAppState((prev) => ({ ...prev, chatOpen: true }))}
          variant="ghost"
          className="absolute top-0 right-0 m-2"
          size="xs"
        >
          <ArrowLeftFromLine size={18} />
        </Button>
      </div>
    );
  };

  /**
   * Render the video player. Safe to assume we have videos at this point
   * as we don't call this if haveVideos isn't true.
   *
   * If there is no selected videos (because we've just launched, or just
   * changed category) then just play the first video in the table.
   */
  const getVideoPlayer = () => {
    const toShow = filteredState[0] ? filteredState[0] : categoryState[0];
    const povs = [toShow, ...toShow.multiPov].sort(povDiskFirstNameSort);

    const videosToPlay =
      selectedVideos.length > 0 ? selectedVideos : povs.slice(0, 1);

    return (
      <Resizable
        ref={resizableRef}
        defaultSize={{
          height: `${playerHeight.current}px`,
          width: '100%',
        }}
        enable={{ bottom: true }}
        bounds="parent"
        onResize={onResize}
        minHeight={chatOpen ? 500 : undefined}
        handleStyles={{
          bottom: {
            width: '50%',
            left: '25%',
            height: '10px',
            bottom: '-10px',
            position: 'absolute',
            display: 'flex',
            justifyContent: 'center',
          },
        }}
        handleComponent={{
          bottom: <GripHorizontal />,
        }}
      >
        <div className="flex h-full w-full">
          <VideoPlayer
            ref={videoPlayerRef}
            key={videosToPlay.map((rv) => rv.videoName + rv.cloud).join(', ')}
            videos={videosToPlay}
            categoryState={categoryState}
            persistentProgress={persistentProgress}
            config={config}
            appState={appState}
            setAppState={setAppState}
          />

          {chatOpen && renderDrawerOpen()}
          {!chatOpen && renderDrawerClosed()}
        </div>
      </Resizable>
    );
  };

  const getAllSelectedViewpoints = () => {
    const { rows } = table.getSelectedRowModel();

    if (rows.length > 0) {
      const parents = rows.map((r) => r.original);
      const children = parents.flatMap((v) => v.multiPov);
      return parents.concat(children);
    }

    const first = filteredState[0] ? filteredState[0] : categoryState[0];
    return [first, ...first.multiPov];
  };

  const getVideoSelection = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedViewpoints = getAllSelectedViewpoints();

    // We don't want multi player mode to be accessible if there isn't
    // multiple viewpoints, so check for that. Important to filter by
    // unique name here so we don't allow multi player mode for two
    // identical videos with different storage (i.e. disk/cloud).
    //
    // Handle the case where no row is selected yet but we do have atleast
    // an entry in the video selection table so default to the first to
    // decide if we can do multi player mode or not.
    //
    // The dedup function here removes videos with matching names, but
    // possibly alternative storage. We don't want to load a disk and cloud
    // pov of the same video.
    const dedup = (rv: RendererVideo, idx: number, arr: RendererVideo[]) =>
      arr.findIndex((i) => i.videoName === rv.videoName) === idx;

    const selectedRow = selectedRows[0];

    const multiPlayerOpts = (
      selectedRow
        ? [selectedRow.original, ...selectedRow.original.multiPov]
        : filteredState[0]
          ? [filteredState[0], ...filteredState[0].multiPov]
          : [categoryState[0], ...categoryState[0].multiPov]
    )
      .sort(povDiskFirstNameSort)
      .filter(dedup);

    const names = multiPlayerOpts.map((rv) => rv.videoName);
    const unique = [...new Set(names)];
    const allowMultiPlayer = unique.length > 1;

    const protectVideo = (
      _event: React.SyntheticEvent,
      protect: boolean,
      videos: RendererVideo[],
    ) => {
      window.electron.ipcRenderer.sendMessage('videoButton', [
        'protect',
        protect,
        videos,
      ]);

      setVideoState((prev) => {
        const state = [...prev];

        state.forEach((rv) => {
          // A video is uniquely identified by its name and storage type.
          const match = videos.find(
            (v) => v.videoName === rv.videoName && v.cloud === rv.cloud,
          );

          if (match) {
            rv.isProtected = protect;
          }
        });

        return state;
      });
    };

    const renderProtectButton = () => {
      const toProtect = selectedViewpoints;

      // If any videos in our selection are not protected, then the button's
      // action is to protect.
      const lock = !toProtect.every((v) => v.isProtected);

      // Disable the protect button if there are no selected viewpoints, if we
      // don't have write permissions, or if the action is to unprotect and we
      // don't have delete permissions.
      const noPermission =
        (!write && toProtect.some((v) => v.cloud)) || // Some in the selection are cloud videos and no write permission.
        (!del && !lock && toProtect.some((v) => v.cloud)); // Some in the selection are locked cloud videos no delete permission.

      const disabled = noPermission || toProtect.length < 1;
      const icon = lock ? <LockKeyhole size={18} /> : <LockOpen size={18} />;

      let tooltip = '';

      if (noPermission) {
        tooltip = getLocalePhrase(language, Phrase.GuildNoPermission);
      } else if (lock) {
        tooltip = getLocalePhrase(language, Phrase.StarSelected);
      } else {
        tooltip = getLocalePhrase(language, Phrase.UnstarSelected);
      }

      return (
        <Tooltip content={tooltip}>
          <div>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={(e) => protectVideo(e, lock, toProtect)}
              className="border border-background"
            >
              {icon}
            </Button>
          </div>
        </Tooltip>
      );
    };

    const renderDeleteButton = () => {
      const toDelete = selectedViewpoints;

      const noPermission = !del && toDelete.some((v) => v.cloud);
      const disabled = toDelete.length < 1 || noPermission;

      const tooltip = noPermission
        ? getLocalePhrase(language, Phrase.GuildNoPermission)
        : getLocalePhrase(language, Phrase.BulkDeleteButtonTooltip);

      return (
        <Tooltip content={tooltip}>
          <div>
            <DeleteDialog
              key={toDelete.map((v) => v.videoName).join(',')} // Forces a remount on selection change.
              inScope={toDelete}
              appState={appState}
              setVideoState={setVideoState}
              selectedRowCount={selectedRows.length}
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={disabled}
                className="border border-background"
              >
                <Trash size={18} />
              </Button>
            </DeleteDialog>
          </div>
        </Tooltip>
      );
    };

    const renderBulkTransferButton = (upload: boolean) => {
      const toTransfer = selectedViewpoints
        .filter((rv) => rv.cloud === !upload)
        .filter(
          (rv) =>
            selectedViewpoints.filter((v) => v.videoName === rv.videoName)
              .length < 2, // If we have more 2 viewpoints with the same name then one must be disk and one cloud.
        );

      const noPermission = upload && !write;

      const disabled =
        toTransfer.length < 1 || noPermission || !cloudStatus.authorized;

      let tooltip = upload
        ? getLocalePhrase(language, Phrase.BulkUploadButtonTooltip)
        : getLocalePhrase(language, Phrase.BulkDownloadButtonTooltip);

      if (noPermission) {
        tooltip = getLocalePhrase(language, Phrase.GuildNoPermission);
      }

      const icon = upload ? (
        <CloudUpload size={18} />
      ) : (
        <CloudDownload size={18} />
      );

      return (
        <Tooltip content={tooltip}>
          <div>
            <BulkTransferDialog
              key={toTransfer.map((v) => v.videoName).join(',')} // Forces a remount on selection change.
              inScope={toTransfer}
              appState={appState}
              upload={upload}
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={disabled}
                className="border border-background"
              >
                {icon}
              </Button>
            </BulkTransferDialog>
          </div>
        </Tooltip>
      );
    };

    const renderSelectionLabel = () => {
      const { language } = appState;
      let text = getLocalePhrase(language, Phrase.Selection);

      if (selectedRows.length > 1) {
        text += ` (${selectedRows.length})`;
      }

      if (!config.cloudStorage || (write && del)) {
        // Cloud storage if off, or we have full permission. No need
        // to render the disk only switch.
        return <Label>{text}</Label>;
      }

      return <Label>{text}</Label>;
    };

    return (
      <>
        <div className="w-full flex justify-evenly items-center gap-x-2 px-4 py-2">
          <MultiPovPlaybackToggles
            appState={appState}
            setAppState={setAppState}
            allowMultiPlayer={allowMultiPlayer}
            opts={multiPlayerOpts}
          />
          {!isClips && (
            <VideoMarkerToggles
              category={category}
              config={config}
              setConfig={setConfig}
              appState={appState}
            />
          )}

          <div className="flex flex-grow gap-x-2">
            <div className="flex-grow">
              <SearchBar
                key={category}
                appState={appState}
                setAppState={setAppState}
                filteredState={filteredState}
              />
            </div>
            <div>
              <Label>{getLocalePhrase(language, Phrase.DateFilter)}</Label>
              <DateRangePicker appState={appState} setAppState={setAppState} />
            </div>
            <div>
              <Label>
                {getLocalePhrase(language, Phrase.StorageFilterLabel)}
              </Label>
              <StorageFilterToggle
                categoryState={categoryState}
                appState={appState}
                setAppState={setAppState}
                table={table}
              />
            </div>
          </div>

          <div>
            {renderSelectionLabel()}
            <div className="flex gap-x-1 mr-2 py-[1px]">
              {config.cloudUpload && renderBulkTransferButton(true)}
              {config.cloudStorage && renderBulkTransferButton(false)}
              {renderProtectButton()}
              {renderDeleteButton()}
            </div>
          </div>
        </div>
        <div className="w-full h-full overflow-hidden">
          <VideoSelectionTable
            table={table}
            appState={appState}
            setAppState={setAppState}
            persistentProgress={persistentProgress}
          />
        </div>
      </>
    );
  };

  const openSetupInstructions = () => {
    window.electron.ipcRenderer.sendMessage('openURL', [
      'https://www.warcraftrecorder.com/about',
    ]);
  };

  const renderFirstTimeUserPrompt = () => {
    return (
      <div className="flex items-center justify-center flex-col w-1/2 h-1/2 text-center font-sans text-foreground gap-y-6">
        <h1 className="text-xl font-bold">
          {getLocalePhrase(language, Phrase.NoVideosSaved)}
        </h1>
        <Separator className="my-2" />
        <h2 className="text-foreground font-sans text-lg">
          {getLocalePhrase(language, Phrase.FirstTimeHere)}
        </h2>
        <Button onClick={openSetupInstructions}>
          {getLocalePhrase(language, Phrase.SetupInstructions)}
        </Button>
      </div>
    );
  };

  const renderFirstTimeClipPrompt = () => {
    return (
      <div className="flex items-center justify-center flex-col w-1/2 h-1/2 text-center font-sans text-foreground gap-y-6">
        <h1 className="text-xl font-bold">
          {getLocalePhrase(language, Phrase.NoClipsSaved)}
        </h1>
        <Separator className="my-2" />
        <h2 className="text-foreground font-sans text-lg">
          {getLocalePhrase(language, Phrase.ClipsDisplayedHere)}
        </h2>
      </div>
    );
  };

  const renderVideoPage = () => {
    return (
      <div className="flex flex-col h-full w-full bg-background-higher pt-[32px]">
        {getVideoPlayer()}
        {getVideoSelection()}
      </div>
    );
  };

  if (haveVideos) {
    return renderVideoPage();
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-background-higher pt-[32px]">
      {isClips && renderFirstTimeClipPrompt()}
      {!isClips && renderFirstTimeUserPrompt()}
    </div>
  );
};

export default CategoryPage;
