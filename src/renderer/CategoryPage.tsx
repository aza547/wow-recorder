import * as React from 'react';
import { AppState, RendererVideo } from 'main/types';
import { MutableRefObject } from 'react';
import { Trash } from 'lucide-react';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import { VideoPlayer } from './VideoPlayer';
import { VideoCategory } from '../types/VideoCategory';
import SearchBar from './SearchBar';
import VideoMarkerToggles from './VideoMarkerToggles';
import { useSettings } from './useSettings';
import { getVideoCategoryFilter } from './rendererutils';
import StateManager from './StateManager';
import Separator from './components/Separator/Separator';
import { Button } from './components/Button/Button';
import VideoSelectionTable from './components/Tables/VideoSelectionTable';
import useTable from './components/Tables/TableData';
import DeleteDialog from './DeleteDialog';

interface IProps {
  category: VideoCategory;
  stateManager: MutableRefObject<StateManager>;
  videoState: RendererVideo[];
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
    videoState,
    appState,
    setAppState,
    persistentProgress,
    playerHeight,
  } = props;
  const [config, setConfig] = useSettings();
  const table = useTable(videoState, appState);

  const categoryFilter = getVideoCategoryFilter(category);
  const categoryState = videoState.filter(categoryFilter);
  const haveVideos = categoryState.length > 0;

  const isClips = category === VideoCategory.Clips;

  const getVideoPlayer = () => {
    const { playingVideo } = appState;

    if (playingVideo === undefined) {
      return <></>;
    }

    return (
      <VideoPlayer
        key={playingVideo.videoSource}
        video={playingVideo}
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
      Phrase.ThisWillPermanentlyDelete
    )} ${unprot.length} ${getLocalePhrase(
      appState.language,
      Phrase.RecordingsFullStop
    )}`;

    if (prot.length > 0) {
      deleteWarning += ' ';

      deleteWarning += getLocalePhrase(
        appState.language,
        Phrase.ThisSelectionIncludes
      );

      deleteWarning += ' ';
      deleteWarning += prot.length;
      deleteWarning += ' ';

      deleteWarning += getLocalePhrase(
        appState.language,
        Phrase.StarredRecordingNotDeleted
      );
    }

    return (
      <>
        <div className="w-full flex justify-evenly items-center gap-x-5 px-4 pt-2">
          {!isClips && (
            <VideoMarkerToggles
              category={category}
              config={config}
              setConfig={setConfig}
              appState={appState}
            />
          )}
          <div className="flex-grow">
            <SearchBar appState={appState} setAppState={setAppState} />
          </div>
          <div className="pt-6">
            <DeleteDialog
              onDelete={() => bulkDelete(unprot)}
              tooltipContent={getLocalePhrase(
                appState.language,
                Phrase.BulkDeleteButtonTooltip
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
        <div className="w-full h-full flex justify-evenly border-b border-video-border items-start gap-x-5 px-4 py-2 overflow-hidden">
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

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-background-higher pt-[32px]">
      {haveVideos && getVideoPlayer()}
      {haveVideos && getVideoSelection()}
      {!haveVideos && !isClips && renderFirstTimeUserPrompt()}
      {!haveVideos && isClips && renderFirstTimeClipPrompt()}
    </div>
  );
};

export default CategoryPage;
