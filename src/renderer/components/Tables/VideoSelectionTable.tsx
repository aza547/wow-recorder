import { AppState, RendererVideo } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import { MutableRefObject } from 'react';
import StateManager from 'renderer/StateManager';
import RaidSelectionTable from './RaidSelectionTable';

interface IProps {
  category: VideoCategory;
  videoState: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  stateManager: MutableRefObject<StateManager>;
  persistentProgress: MutableRefObject<number>;
}

const VideoSelectionTable = (props: IProps) => {
  const {
    videoState,
    category,
    appState,
    setAppState,
    stateManager,
    persistentProgress,
  } = props;

  if (category === VideoCategory.Raids) {
    return (
      <RaidSelectionTable
        videoState={videoState}
        appState={appState}
        setAppState={setAppState}
        stateManager={stateManager}
        persistentProgress={persistentProgress}
      />
    );
  }

  return <> </>;
};

export default VideoSelectionTable;
