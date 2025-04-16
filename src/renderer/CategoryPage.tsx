import * as React from 'react';
import { AppState, RendererVideo } from 'main/types';
import { MutableRefObject, useMemo } from 'react';
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
import { povDiskFirstNameSort } from './rendererutils';
import StateManager from './StateManager';
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
import Datepicker, { DateValueType } from 'react-tailwindcss-datepicker';
import useTable from './components/Tables/TableData';
import TagDialog from './TagDialog';
import { Tooltip } from './components/Tooltip/Tooltip';

interface IProps {
  category: VideoCategory;
  stateManager: MutableRefObject<StateManager>;
  categoryState: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  playerHeight: MutableRefObject<number>;
}

/**
 * A page representing a video category.
 */
const CategoryPage = (props: IProps) => {
  const {
    category,
    stateManager,
    categoryState,
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
  } = appState;

  const [config, setConfig] = useSettings();

  const filteredState = useMemo<RendererVideo[]>(() => {
    const queryFilter = (rv: RendererVideo) =>
      new VideoFilter(videoFilterTags, dateRangeFilter, rv, language).filter();

    return categoryState.filter(queryFilter);
  }, [categoryState, dateRangeFilter, videoFilterTags, language]);

  // The data backing the video selection table.
  const table = useTable(filteredState, appState, stateManager);

  const haveVideos = categoryState.length > 0;
  const isClips = category === VideoCategory.Clips;

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
        defaultSize={{
          height: `${playerHeight.current}px`,
          width: '100%',
        }}
        enable={{ bottom: true }}
        bounds="parent"
        onResize={onResize}
        handleComponent={{
          bottom: (
            <div className="flex items-center justify-center mt-1">
              <GripHorizontal />
            </div>
          ),
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

  const bulkDelete = (videos: RendererVideo[]) => {
    window.electron.ipcRenderer.sendMessage('deleteVideos', videos);
    stateManager.current.deleteVideos(videos);
  };

  const getVideoSelection = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedViewpoints = getAllSelectedViewpoints();

    const deleteWarning = `${getLocalePhrase(
      appState.language,
      Phrase.ThisWillPermanentlyDelete,
    )} ${selectedViewpoints.length} ${getLocalePhrase(
      appState.language,
      Phrase.Recordings,
    )} ${getLocalePhrase(
      appState.language,
      Phrase.From,
    )} ${selectedRows.length} ${getLocalePhrase(appState.language, Phrase.Rows)}.`;

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

    const renderTagButton = () => {
      let tag = '';
      let icon = <MessageSquare size={20} />;
      let tooltip = getLocalePhrase(appState.language, Phrase.TagButtonTooltip);
      const foundTag = selectedViewpoints.map((v) => v.tag).find((t) => t);

      if (foundTag) {
        tag = foundTag;
        icon = <MessageSquareMore size={20} />;

        if (tag.length > 50) {
          tooltip = `${tag.slice(0, 50)}...`;
        } else {
          tooltip = tag;
        }
      }

      return (
        <TagDialog
          initialTag={tag}
          videos={selectedViewpoints}
          stateManager={stateManager}
          tooltipContent={tooltip}
          appState={appState}
        >
          <Button
            variant="secondary"
            size="sm"
            className="h-10"
            disabled={selectedRows.length > 1}
          >
            {icon}
          </Button>
        </TagDialog>
      );
    };

    const protectVideo = (
      _event: React.SyntheticEvent,
      protect: boolean,
      videos: RendererVideo[],
    ) => {
      stateManager.current.setProtected(protect, videos);

      window.electron.ipcRenderer.sendMessage('videoButton', [
        'protect',
        protect,
        videos,
      ]);
    };

    const renderProtectButton = () => {
      const allProtected = selectedViewpoints.every((v) => v.isProtected);

      const icon = allProtected ? (
        <LockOpen size={20} />
      ) : (
        <LockKeyhole size={20} />
      );

      const tooltip = allProtected
        ? getLocalePhrase(appState.language, Phrase.UnstarSelected)
        : getLocalePhrase(appState.language, Phrase.StarSelected);

      return (
        <Button
          variant="secondary"
          size="sm"
          className="h-10"
          disabled={selectedViewpoints.length < 1}
          onClick={(e) => protectVideo(e, !allProtected, selectedViewpoints)}
        >
          <Tooltip content={tooltip}>{icon}</Tooltip>
        </Button>
      );
    };

    const renderDeleteButton = () => {
      return (
        <DeleteDialog
          onDelete={() => bulkDelete(selectedViewpoints)}
          tooltipContent={getLocalePhrase(
            appState.language,
            Phrase.BulkDeleteButtonTooltip,
          )}
          warning={deleteWarning}
          appState={appState}
        >
          <Button
            variant="secondary"
            size="sm"
            className="h-10"
            disabled={selectedViewpoints.length < 1}
          >
            <Trash size={20} />
          </Button>
        </DeleteDialog>
      );
    };

    const renderSelectionLabel = () => {
      let text = getLocalePhrase(appState.language, Phrase.Selection);

      if (selectedRows.length > 1) {
        text += ` (${selectedRows.length})`;
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
        <div className="w-full flex justify-evenly items-center gap-x-5 px-4 py-2">
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
          <div className="flex flex-grow">
            <div className="flex-grow">
              <SearchBar
                key={category}
                appState={appState}
                setAppState={setAppState}
                filteredState={filteredState}
              />
            </div>
            <div className="ml-2">
              <Label>Date Filter</Label>
              <Datepicker
                value={dateRangeFilter}
                onChange={(v) => {
                  // This looks a bit verbose, but it seems the react library
                  // used here will provide the same date object if the range
                  // is a single day, as well as setting the time to the current
                  // time. So make sure that we have separate date objects, set
                  // to midnight and a minute to midnight to cover the full day.
                  const drf: DateValueType = {
                    startDate: null,
                    endDate: null,
                  };

                  if (v && v.startDate) {
                    drf.startDate = new Date(v.startDate);
                    drf.startDate.setHours(0, 0, 0, 0);
                  }
                  if (v && v.endDate) {
                    drf.endDate = new Date(v.endDate);
                    drf.endDate.setHours(23, 59, 59, 999);
                  }

                  setAppState((prev) => ({
                    ...prev,
                    dateRangeFilter: drf,
                  }));
                }}
                separator="to"
                displayFormat="DD/MM/YY"
                showShortcuts
                showFooter
                primaryColor="red"
                containerClassName="relative tailwind-datepicker" // See App.css for tailwind overrides. This library doesn't expose much.
                inputClassName="relative transition-all duration-300 h-10 pl-4 pr-14 w-full border border-background bg-card text-foreground placeholder:text-foreground rounded-lg text-sm placeholder:text-sm"
              />
            </div>
          </div>

          <div>
            <Label>{renderSelectionLabel()}</Label>
            <div className="flex gap-x-2 mr-2">
              {renderTagButton()}
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
            stateManager={stateManager}
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
          {getLocalePhrase(appState.language, Phrase.NoVideosSaved)}
        </h1>
        <Separator className="my-2" />
        <h2 className="text-foreground font-sans text-lg">
          {getLocalePhrase(appState.language, Phrase.FirstTimeHere)}
        </h2>
        <Button onClick={openSetupInstructions}>
          {getLocalePhrase(appState.language, Phrase.SetupInstructions)}
        </Button>
      </div>
    );
  };

  const renderFirstTimeClipPrompt = () => {
    return (
      <div className="flex items-center justify-center flex-col w-1/2 h-1/2 text-center font-sans text-foreground gap-y-6">
        <h1 className="text-xl font-bold">
          {getLocalePhrase(appState.language, Phrase.NoClipsSaved)}
        </h1>
        <Separator className="my-2" />
        <h2 className="text-foreground font-sans text-lg">
          {getLocalePhrase(appState.language, Phrase.ClipsDisplayedHere)}
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
