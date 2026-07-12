import {
  ActivityStatus,
  AppState,
  InstantReplayPlayerData,
  InstantReplayState,
} from 'main/types';
import VideoPlayer from './VideoPlayer';
import { Dispatch, RefObject, SetStateAction, useEffect } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import { Button } from './components/Button/Button';
import { ArrowRight } from 'lucide-react';
import { Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';

const ipc = window.electron.ipcRenderer;

interface IProps {
  instantReplayState: InstantReplayState;
  setInstantReplayState: Dispatch<SetStateAction<InstantReplayState>>;
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  persistentProgress: RefObject<number>;
  config: ConfigurationSchema;
  activityStatus: ActivityStatus | null;
}

const InstantReplay = (props: IProps) => {
  const {
    instantReplayState,
    setInstantReplayState,
    appState,
    setAppState,
    persistentProgress,
    config,
    activityStatus,
  } = props;

  const { language } = appState;
  const { currentPath, openPath } = instantReplayState;

  useEffect(() => {
    if (openPath) {
      ipc.setOpenInstantReplayFile(openPath);
    }

    return () => {
      ipc.setOpenInstantReplayFile(null);
    };
  }, [openPath]);

  const goToLatestInstantReplay = () => {
    setInstantReplayState((prev) => ({
      ...prev,
      openPath: prev.currentPath,
    }));
  };

  const renderStaleReplayNotification = () => {
    return (
      <div className="fixed bottom-16 right-2 w-[320px] bg-background-higher border border-card px-4 py-2 rounded-lg shadow-lg flex items-center ">
        <p className="text-xs text-foreground-lighter">
          {getLocalePhrase(language, Phrase.InstantReplayStale)}
        </p>
        <Button size="sm" onClick={goToLatestInstantReplay}>
          <ArrowRight size={18} />
        </Button>
      </div>
    );
  };

  const replayIsStale = openPath !== currentPath && currentPath;

  if (!openPath) {
    // Should never happen.
    return <></>;
  }

  const instantReplay: InstantReplayPlayerData = {
    path: openPath,
    deaths: activityStatus?.deaths ?? [],
    challengeModeTimeline: activityStatus?.challengeModeTimeline,
  };

  return (
    <div className="flex h-full w-full bg-background-higher pt-[32px]">
      <VideoPlayer
        key={openPath}
        videos={[]}
        instantReplay={instantReplay}
        categoryState={[]}
        persistentProgress={persistentProgress}
        config={config}
        appState={appState}
        setAppState={setAppState}
      />
      {replayIsStale && renderStaleReplayNotification()}
    </div>
  );
};

export default InstantReplay;
