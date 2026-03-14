import { KillVideoStatus } from 'main/types';
import Progress from './components/Progress/Progress';
import { cn } from './components/utils';
import { useEffect, useState } from 'react';
import { getLocalePhrase, Language } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';

const ipc = window.electron.ipcRenderer;

interface IProps {
  language: Language;
}

const KillVideoProgress = (props: IProps) => {
  const { language } = props;
  const [killVideoStatus, setKillVideoStatus] = useState<KillVideoStatus>({
    perc: 0,
    queued: 0,
  });

  const updateKillVideoStatus = (status: unknown) => {
    setKillVideoStatus(status as KillVideoStatus);
  };

  useEffect(() => {
    ipc.on('updateKillVideoStatus', updateKillVideoStatus);

    return () => {
      ipc.removeAllListeners('updateKillVideoStatus');
    };
  }, []);

  if (killVideoStatus.queued < 1) {
    return <></>;
  }

  const descr =
    killVideoStatus.queued > 1
      ? `${getLocalePhrase(language, Phrase.KillVideoCreating)} (+${killVideoStatus.queued - 1})`
      : getLocalePhrase(language, Phrase.KillVideoCreating);

  const progress =
    killVideoStatus.perc < 1
      ? getLocalePhrase(language, Phrase.Preparing) + '...'
      : `${killVideoStatus.perc}%`;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[30rem]',
        'rounded-md bg-background px-4 py-2.5 shadow-lg',
        'animate-in slide-in-from-bottom-full fade-in duration-300',
        'border border-white/10 bg-background shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:rounded-xl',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-foreground-lighter text-sm font-bold whitespace-nowrap">
          {descr}
        </span>
        <Progress value={killVideoStatus.perc} className="h-1.5" />
        <span className="text-foreground-lighter text-sm font-bold tabular-nums  text-right">
          {progress}
        </span>
      </div>
    </div>
  );
};

export default KillVideoProgress;
