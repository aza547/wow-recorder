import { useEffect, useState } from 'react';
import { RelocateStatus } from 'main/types';
import Progress from 'renderer/components/Progress/Progress';
import { cn } from 'renderer/components/utils';

const ipc = window.electron.ipcRenderer;

/**
 * A slim, gentle progress bar that appears beneath the top-left status while a
 * freshly cut VOD is being moved out of the local buffer to permanent storage
 * (the "review while relocating" feature). Self-contained: it listens to the
 * 'updateRelocateStatus' channel and hides itself when nothing is in flight.
 *
 * perc < 0 indicates an indeterminate state (the copy target doesn't expose
 * progressive size growth), shown as a gently pulsing full bar.
 */
const RelocateProgress = () => {
  const [status, setStatus] = useState<RelocateStatus>({ perc: 0, queued: 0 });

  useEffect(() => {
    const handler = (s: unknown) => setStatus(s as RelocateStatus);
    ipc.on('updateRelocateStatus', handler);

    return () => {
      ipc.removeAllListeners('updateRelocateStatus');
    };
  }, []);

  if (status.queued < 1) {
    return null;
  }

  const indeterminate = status.perc < 0;

  const label =
    status.queued > 1
      ? `Moving to storage (+${status.queued - 1})`
      : 'Moving to storage';

  return (
    <div className="mt-1 w-40 max-w-full flex flex-col gap-y-0.5 animate-in fade-in duration-300">
      <span className="text-foreground-lighter text-[10px] font-semibold opacity-60">
        {label}
      </span>
      <Progress
        value={indeterminate ? 100 : status.perc}
        className={cn(
          'h-1 rounded-full',
          indeterminate && 'animate-pulse opacity-60',
        )}
      />
    </div>
  );
};

export default RelocateProgress;
