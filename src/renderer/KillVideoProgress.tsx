import { KillVideoStatus } from 'main/types';
import Progress from './components/Progress/Progress';
import { cn } from './components/utils';
import { useEffect, useState } from 'react';

const ipc = window.electron.ipcRenderer;

const KillVideoProgress = () => {
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
      ? `Creating kill video (+${killVideoStatus.queued - 1})`
      : 'Creating kill video';

  const progress =
    killVideoStatus.perc < 1 ? 'Preparing...' : `${killVideoStatus.perc}%`;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[30rem]',
        'rounded-md bg-background px-4 py-2.5 shadow-lg',
        'animate-in slide-in-from-bottom-full fade-in duration-300',
        'border border-card',
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
