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
  Eye,
  GripHorizontal,
  LockKeyhole,
  Trash,
  MessageSquare,
  MessageSquareMore,
  LockOpen,
} from 'lucide-react';
import { getLocalePhrase, Phrase } from 'localisation/translations';
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
import VideoPlayer from './VideoPlayer';
import Label from './components/Label/Label';
import { Popover, PopoverContent } from './components/Popover/Popover';
import { PopoverTrigger } from '@radix-ui/react-popover';
import ViewpointSelection from './components/Viewpoints/ViewpointSelection';
import useTable from './components/Tables/TableData';
import { Tooltip } from './components/Tooltip/Tooltip';
import DateRangePicker from './DateRangePicker';
import StorageFilterToggle from './StorageFilterToggle';
import VideoCorrelator from './VideoCorrelator';

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
    viewpointSelectionOpen,
    cloudStatus,
    storageFilter,
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
        <VideoPlayer
          key={videosToPlay.map((rv) => rv.videoName + rv.cloud).join(', ')}
          videos={videosToPlay}
          categoryState={categoryState}
          persistentProgress={persistentProgress}
          config={config}
          appState={appState}
          setAppState={setAppState}
        />
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

    const renderViewpointSelectionPopover = () => {
      return (
        <Popover
          open={viewpointSelectionOpen}
          onOpenChange={() => {
            setAppState((a) => {
              return {
                ...a,
                viewpointSelectionOpen: !a.viewpointSelectionOpen,
              };
            });
          }}
        >
          <PopoverTrigger asChild className="absolute top-[90px] left-0">
            <Button
              variant={viewpointSelectionOpen ? 'default' : 'secondary'}
              size="xs"
              className="z-10 h-20 rounded-l-none flex justify-start p-[3px]"
            >
              <Eye size={15} />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            onEscapeKeyDown={(e) => {
              // Close the popover when escape is pressed.
              setAppState((a) => {
                return {
                  ...a,
                  viewpointSelectionOpen: false,
                };
              });

              // Need this for some reason else the popover doesn't close.
              e.preventDefault();
              e.stopPropagation();
            }}
            side="left"
            className="p-0 absolute top-[-40px] left-[30px] w-auto min-w-max"
            onInteractOutside={(e) => {
              e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              e.preventDefault();
            }}
            onFocusOutside={(e) => {
              e.preventDefault();
            }}
          >
            <ViewpointSelection
              video={selectedRow ? selectedRow.original : filteredState[0]}
              appState={appState}
              setAppState={setAppState}
              persistentProgress={persistentProgress}
            />
          </PopoverContent>
        </Popover>
      );
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
              {renderProtectButton()}
              {renderDeleteButton()}
            </div>
          </div>
        </div>
        <div className="relative">{renderViewpointSelectionPopover()}</div>
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
      'https://github.com/aza547/wow-recorder#readme',
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
