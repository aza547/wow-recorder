import * as React from 'react';
import { AppState, RendererVideo } from 'main/types';
import { MutableRefObject } from 'react';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import { VideoPlayer } from './VideoPlayer';
import { VideoCategory } from '../types/VideoCategory';
import SearchBar from './SearchBar';
import VideoMarkerToggles from './VideoMarkerToggles';
import { useSettings } from './useSettings';
import { getVideoCategoryFilter } from './rendererutils';
import VideoFilter from './VideoFilter';
import StateManager from './StateManager';
import Separator from './components/Separator/Separator';
import { Button } from './components/Button/Button';
import VideoSelectionTable from './components/Tables/VideoSelectionTable';

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
  const { videoFilterQuery } = appState;
  const [config, setConfig] = useSettings();
  const categoryFilter = getVideoCategoryFilter(category);
  const categoryState = videoState.filter(categoryFilter);
  const haveVideos = categoryState.length > 0;
  const isClips = category === VideoCategory.Clips;

  const filteredState = categoryState.filter((video) =>
    new VideoFilter(videoFilterQuery, video).filter()
  );

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
      />
    );
  };

  const getVideoSelection = () => {
    return (
      <>
        <div className="w-full flex justify-evenly items-center gap-x-5 px-4 pt-2">
          {!isClips && (
            <VideoMarkerToggles
              category={category}
              config={config}
              setConfig={setConfig}
            />
          )}
          <div className="flex-grow">
            <SearchBar appState={appState} setAppState={setAppState} />
          </div>
        </div>
        <div className="w-full h-full flex justify-evenly border-b border-video-border items-start gap-x-5 px-4 pt-2 overflow-hidden">
          <ScrollArea withScrollIndicators={false} className="h-full w-full">
            <VideoSelectionTable
              videoState={filteredState}
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
          You have no videos saved for this category
        </h1>
        <Separator className="my-2" />
        <h2 className="text-foreground font-sans text-lg">
          If it is your first time here, setup instructions can be found at the
          link below. If you have problems, please use the Discord #help channel
          to get support.
        </h2>
        <Button onClick={openSetupInstructions}>Setup Instructions</Button>
      </div>
    );
  };

  const renderFirstTimeClipPrompt = () => {
    return (
      <div className="flex items-center justify-center flex-col w-1/2 h-1/2 text-center font-sans text-foreground gap-y-6">
        <h1 className="text-xl font-bold">You have no clips saved</h1>
        <Separator className="my-2" />
        <h2 className="text-foreground font-sans text-lg">
          Videos you clip will be displayed here.
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
