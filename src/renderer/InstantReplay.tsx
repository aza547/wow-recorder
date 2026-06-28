import { AppState } from 'main/types';
import VideoPlayer from './VideoPlayer';
import { useSettings } from './useSettings';
import { Dispatch, RefObject, SetStateAction } from 'react';
import { Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import Separator from './components/Separator/Separator';
import { Radio } from 'lucide-react';

interface IProps {
  instantReplayPath: string | null;
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  persistentProgress: RefObject<number>;
}

const InstantReplay = (props: IProps) => {
  const { instantReplayPath, appState, setAppState, persistentProgress } =
    props;

  const [config] = useSettings();

  if (!instantReplayPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-background-higher pt-[32px]">
        <div className="flex items-center justify-center flex-col w-1/2 h-1/2 text-center font-sans text-foreground gap-y-6">
          <Radio size={40} />
          <h1 className="text-xl font-bold">
            {getLocalePhrase(appState.language, Phrase.InstantReplayEnded)}
          </h1>
          <Separator className="my-2" />
          <h2 className="text-foreground font-sans text-lg">
            {getLocalePhrase(appState.language, Phrase.InstantReplayEndedDescr)}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background-higher pt-[32px]">
      <VideoPlayer
        videos={[]}
        instantReplayPath={instantReplayPath}
        categoryState={[]}
        persistentProgress={persistentProgress}
        config={config}
        appState={appState}
        setAppState={setAppState}
      />
    </div>
  );
};

export default InstantReplay;
