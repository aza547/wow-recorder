import * as React from 'react';
import { AppState, RendererVideo } from 'main/types';
import { MutableRefObject, useMemo } from 'react';
import { Trash } from 'lucide-react';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import { VideoPlayer } from './VideoPlayer';
import { VideoCategory } from '../types/VideoCategory';
import SearchBar from './SearchBar';
import VideoMarkerToggles from './VideoMarkerToggles';
import { useSettings } from './useSettings';
import { povDiskFirstNameSort } from './rendererutils';
import StateManager from './StateManager';
import Separator from './components/Separator/Separator';
import { Button } from './components/Button/Button';
import VideoSelectionTable from './components/Tables/VideoSelectionTable';
import useTable from './components/Tables/TableData';
import DeleteDialog from './DeleteDialog';
import MultiPovPlaybackToggles from './MultiPovPlaybackToggles';
import VideoFilter from './VideoFilter';

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
  const { selectedVideos, selectedRow, videoFilterTags, language } = appState;

  const [config, setConfig] = useSettings();

  const filteredState = useMemo<RendererVideo[]>(() => {
    const queryFilter = (rv: RendererVideo) =>
      new VideoFilter(videoFilterTags, rv, language).filter();

    return categoryState.filter(queryFilter);
  }, [categoryState, videoFilterTags, language]);

  const table = useTable(filteredState, appState);
  const haveVideos = categoryState.length > 0;
  const isClips = category === VideoCategory.Clips;

  const getVideoPlayer = () => {
    // Safe to assume we have videos at this point as we don't call this if
    // haveVideos isn't true.
    const povs = [filteredState[0], ...filteredState[0].multiPov].sort(
      povDiskFirstNameSort,
    );

    // If there is no selectedVideos (because we've just launched, or just
    // changed category) then just play the first video in the table.
    const videosToPlay =
      selectedVideos.length > 0 ? selectedVideos : povs.slice(0, 1);

    return (
      <VideoPlayer
        key={videosToPlay.map((rv) => rv.videoName + rv.cloud).join(', ')}
        videos={videosToPlay}
        persistentProgress={persistentProgress}
        config={config}
        playerHeight={playerHeight}
        appState={appState}
        setAppState={setAppState}
      />
    );
  };

  const getAllSelectedViewpoints = () => {
    const { rows } = table.getSelectedRowModel();
    const parents = rows.map((r) => r.original);
    const children = parents.flatMap((v) => v.multiPov);
    return parents.concat(children);
  };

  const bulkDelete = (videos: RendererVideo[]) => {
    window.electron.ipcRenderer.sendMessage('deleteVideosBulk', videos);
    stateManager.current.bulkDeleteVideo(videos);
  };

  const getVideoSelection = () => {
    const viewpoints = getAllSelectedViewpoints();
    const prot = viewpoints.filter((v) => v.isProtected);
    const unprot = viewpoints.filter((v) => !v.isProtected);

    let deleteWarning = `${getLocalePhrase(
      appState.language,
      Phrase.ThisWillPermanentlyDelete,
    )} ${unprot.length} ${getLocalePhrase(
      appState.language,
      Phrase.RecordingsFullStop,
    )}`;

    if (prot.length > 0) {
      deleteWarning += ' ';

      deleteWarning += getLocalePhrase(
        appState.language,
        Phrase.ThisSelectionIncludes,
      );

      deleteWarning += ' ';
      deleteWarning += prot.length;
      deleteWarning += ' ';

      deleteWarning += getLocalePhrase(
        appState.language,
        Phrase.StarredRecordingNotDeleted,
      );
    }

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

    const multiPlayerOpts = (
      selectedRow
        ? [selectedRow.original, ...selectedRow.original.multiPov]
        : [filteredState[0], ...filteredState[0].multiPov]
    )
      .sort(povDiskFirstNameSort)
      .filter(dedup);

    const names = multiPlayerOpts.map((rv) => rv.videoName);
    const unique = [...new Set(names)];
    const allowMultiPlayer = unique.length > 1;

    return (
      <>
        <div className="w-full flex justify-evenly items-center gap-x-5 px-4 pt-2">
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
          <div className="flex-grow">
            <SearchBar
              key={category}
              appState={appState}
              setAppState={setAppState}
              filteredState={filteredState}
            />
          </div>
          <div className="pt-6">
            <DeleteDialog
              onDelete={() => bulkDelete(unprot)}
              tooltipContent={getLocalePhrase(
                appState.language,
                Phrase.BulkDeleteButtonTooltip,
              )}
              warning={deleteWarning}
              skipPossible={false}
              appState={appState}
            >
              <Button
                variant="ghost"
                size="xs"
                disabled={viewpoints.length < 1}
              >
                <Trash size={20} />
              </Button>
            </DeleteDialog>
          </div>
        </div>
        <div className="w-full h-full flex justify-evenly border-b border-video-border items-start gap-x-5 px-1 py-1 overflow-hidden">
          <ScrollArea withScrollIndicators={false} className="h-full w-full">
            <VideoSelectionTable
              table={table}
              appState={appState}
              setAppState={setAppState}
              stateManager={stateManager}
              persistentProgress={persistentProgress}
            />
          </ScrollArea>
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
