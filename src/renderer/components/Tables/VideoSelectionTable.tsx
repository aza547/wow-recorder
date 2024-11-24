import { AppState, RendererVideo } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import { MutableRefObject } from 'react';
import StateManager from 'renderer/StateManager';
import RaidSelectionTable from './RaidSelectionTable';
import DungeonSelectionTable from './DungeonSelectionTable';
import ArenaSelectionTable from './ArenaSelectionTable';
import BattlegroundSelectionTable from './BattlegroundSelectionTable';
import ClipsSelectionTable from './ClipsSelectionTable';

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

  if (category === VideoCategory.MythicPlus) {
    return (
      <DungeonSelectionTable
        videoState={videoState}
        appState={appState}
        setAppState={setAppState}
        stateManager={stateManager}
        persistentProgress={persistentProgress}
      />
    );
  }

  if (
    category === VideoCategory.TwoVTwo ||
    category === VideoCategory.ThreeVThree ||
    category === VideoCategory.FiveVFive ||
    category === VideoCategory.Skirmish ||
    category === VideoCategory.SoloShuffle
  ) {
    return (
      <ArenaSelectionTable
        videoState={videoState}
        appState={appState}
        setAppState={setAppState}
        stateManager={stateManager}
        persistentProgress={persistentProgress}
      />
    );
  }

  if (category === VideoCategory.Battlegrounds) {
    return (
      <BattlegroundSelectionTable
        videoState={videoState}
        appState={appState}
        setAppState={setAppState}
        stateManager={stateManager}
        persistentProgress={persistentProgress}
      />
    );
  }

  if (category === VideoCategory.Clips) {
    return (
      <ClipsSelectionTable
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
