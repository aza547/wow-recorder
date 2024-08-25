import * as React from 'react';
import Box from '@mui/material/Box';
import { AppState, RendererVideo } from 'main/types';
import { List } from '@mui/material';
import { scrollBarSx } from 'main/constants';
import { MutableRefObject } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { VideoCategory } from '../types/VideoCategory';
import SearchBar from './SearchBar';
import VideoMarkerToggles from './VideoMarkerToggles';
import { useSettings } from './useSettings';
import {
  getFirstInCategory,
  getVideoCategoryFilter,
  povNameSort,
} from './rendererutils';
import VideoFilter from './VideoFilter';
import VideoButton from './VideoButton';
import StateManager from './StateManager';
import Separator from './components/Separator/Separator';
import { Button } from './components/Button/Button';
import { cn } from './components/utils';

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
  const { numVideosDisplayed, videoFilterQuery } = appState;
  const [config, setConfig] = useSettings();
  const categoryFilter = getVideoCategoryFilter(category);
  const categoryState = videoState.filter(categoryFilter);
  const haveVideos = categoryState.length > 0;
  const isClips = category === VideoCategory.Clips;

  const filteredState = categoryState.filter((video) =>
    new VideoFilter(videoFilterQuery, video).filter()
  );

  const slicedState = filteredState.slice(0, numVideosDisplayed);
  const moreVideosRemain = slicedState.length !== filteredState.length;

  const getVideoPlayer = () => {
    const { playingVideo } = appState;
    let videoToPlay: RendererVideo;

    if (playingVideo !== undefined) {
      videoToPlay = playingVideo;
    } else {
      const firstInCategory = getFirstInCategory(videoState, category);

      if (firstInCategory === undefined) {
        // This should never happen, we only load the player if we
        // have atleast one video to show.
        throw new Error('firstInCategory was undefined');
      }

      const povs = [firstInCategory, ...firstInCategory.multiPov].sort(
        povNameSort
      );

      [videoToPlay] = povs;
    }

    return (
      <VideoPlayer
        key={videoToPlay.videoSource}
        video={videoToPlay}
        persistentProgress={persistentProgress}
        config={config}
        playerHeight={playerHeight}
      />
    );
  };

  const handleChangeVideo = (index: number) => {
    const video = videoState[index];
    const povs = [video, ...video.multiPov].sort(povNameSort);
    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        selectedVideoName: video.videoName,
        playingVideo: povs[0],
      };
    });
  };

  const mapActivityToListItem = (video: RendererVideo) => {
    const povs = [video, ...video.multiPov].sort(povNameSort);
    const names = povs.map((v) => v.videoName);
    const selected = appState.selectedVideoName
      ? names.includes(appState.selectedVideoName)
      : categoryState.indexOf(video) === 0;

    const backgroundColor = selected
      ? 'rgba(255, 255, 255, 0.1)'
      : 'transparent';

    return (
      // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
      <div
        className={cn('w-full p-2')}
        key={video.videoSource}
        onClick={() => handleChangeVideo(videoState.indexOf(video))}
        role="button"
      >
        <VideoButton
          key={video.videoSource}
          video={video}
          stateManager={stateManager}
          videoState={videoState}
          setAppState={setAppState}
          selected={selected}
          persistentProgress={persistentProgress}
        />
      </div>
    );
  };

  const loadMoreVideos = () => {
    setAppState((prevState) => {
      return {
        ...prevState,
        numVideosDisplayed: prevState.numVideosDisplayed + 10,
      };
    });
  };

  const getShowMoreButton = () => {
    return (
      <Box
        key="show-more-button-box"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '50px',
        }}
      >
        <Button
          key="show-more-button"
          variant="outline"
          onClick={loadMoreVideos}
        >
          Load More
        </Button>
      </Box>
    );
  };

  const getVideoSelection = () => {
    return (
      <>
        <div className="w-full flex justify-evenly border-b border-video-border items-center gap-x-5 px-2 pt-1 pb-4">
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
        <Box
          sx={{
            height: '100%',
            width: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignContent: 'center',
            ...scrollBarSx,
            '&::-webkit-scrollbar': {
              width: '0.33em',
            },
          }}
        >
          <List sx={{ width: '100%', p: 0 }}>
            {slicedState.map(mapActivityToListItem)}
            {moreVideosRemain && getShowMoreButton()}
          </List>
        </Box>
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
