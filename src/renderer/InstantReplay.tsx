import { AppState, InstantReplayState } from 'main/types';
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
}

const InstantReplay = (props: IProps) => {
  const {
    instantReplayState,
    setInstantReplayState,
    appState,
    setAppState,
    persistentProgress,
    config,
  } = props;

  const { language } = appState;
  const { current, open } = instantReplayState;

  useEffect(() => {
    if (open) {
      ipc.setOpenInstantReplayFile(open.path);
    }

    return () => {
      ipc.setOpenInstantReplayFile(null);
    };
  }, [open]);

  const goToLatestInstantReplay = () => {
    setInstantReplayState((prev) => ({
      ...prev,
      open: prev.current,
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

  if (!open) {
    return <></>;
  }

  const replayIsStale = current && open.path !== current.path;

  return (
    <div className="flex h-full w-full bg-background-higher pt-[32px]">
      <VideoPlayer
        key={open.path}
        videos={[]}
        instantReplay={open}
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
