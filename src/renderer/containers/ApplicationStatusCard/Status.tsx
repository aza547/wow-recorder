/* eslint-disable react/require-default-props */
/* eslint-disable import/prefer-default-export */
import { CloudDownload, CloudUpload, HardDriveDownload } from 'lucide-react';
import { RecStatus, SaveStatus } from 'main/types';
import React from 'react';
import { Button } from 'renderer/components/Button/Button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from 'renderer/components/HoverCard/HoverCard';
import Separator from 'renderer/components/Separator/Separator';
import StatusLight, {
  StatusLightProps,
} from 'renderer/components/StatusLight/StatusLight';
import { cn } from 'renderer/components/utils';
import { useSettings } from 'renderer/useSettings';

type StatusInfo = {
  statusTitle: string;
  statusIndicatorVariant: StatusLightProps['variant'];
  statusDescription: React.ReactNode | undefined;
};

type StatusProps = {
  status: RecStatus;
  error: string;
  savingStatus: SaveStatus;
};

const Status = ({ status, error, savingStatus }: StatusProps) => {
  const stopRecording = () => {
    window.electron.ipcRenderer.sendMessage('recorder', ['stop']);
  };

  const [config] = useSettings();

  const getConfiguredFlavours = () => {
    if (config.recordRetail && config.recordClassic) {
      return 'Retail and Classic';
    }

    if (config.recordRetail) {
      return 'Retail';
    }

    if (config.recordClassic) {
      return 'Classic';
    }

    return 'nothing. You likely want to enable retail, classic, or both in the app settings';
  };

  // The short recording status descriptor used on the status card
  const RecStatusTitle: Record<RecStatus, string> = {
    [RecStatus.Recording]: 'Recording',
    [RecStatus.WaitingForWoW]: 'Waiting',
    [RecStatus.InvalidConfig]: 'Invalid',
    [RecStatus.ReadyToRecord]: 'Ready',
    [RecStatus.FatalError]: 'Error',
    [RecStatus.Overrunning]: 'Overrunning',
    [RecStatus.Reconfiguring]: 'Reconfiguring',
  };

  // The variant applied to the StatusLight on the card, for each status
  const RecStatusVariants: Record<RecStatus, StatusLightProps['variant']> = {
    [RecStatus.Recording]: 'recording',
    [RecStatus.WaitingForWoW]: 'waiting',
    [RecStatus.InvalidConfig]: 'invalid',
    [RecStatus.ReadyToRecord]: 'ready',
    [RecStatus.FatalError]: 'error',
    [RecStatus.Overrunning]: 'overrunning',
    [RecStatus.Reconfiguring]: 'waiting',
  };

  // The description for each status, which shows in the popover when the status title is hovered
  // This can be undefined, to skip the popover functionality altogether
  const RecStatusDescription: Record<RecStatus, React.ReactNode | undefined> = {
    [RecStatus.Recording]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          Warcraft Recorder is currently recording
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          You can force the recording to end. Normally this should not be
          required. This can help end a failed Mythic+ run that would otherwise
          need a few minutes to wrap up.
        </p>
        <div className="flex w-full justify-end">
          <Button size="sm" onClick={stopRecording} className="mt-2 w-1/3">
            Force Stop
          </Button>
        </div>
      </div>
    ),
    [RecStatus.WaitingForWoW]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          Waiting for World of Warcraft to start
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          Warcraft Recorder is configured to record {getConfiguredFlavours()}
        </p>
      </div>
    ),
    [RecStatus.InvalidConfig]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          Warcraft Recorder is misconfigured
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          Please resolve the error below
        </p>
        <p className="text-xs text-error-text">{error}</p>
      </div>
    ),
    [RecStatus.ReadyToRecord]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          Detected World of Warcraft is running
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          Warcraft Recorder is waiting for a recordable event to appear in the
          combat log. Watching log paths:
        </p>
        <ul className="text-xs text-popover-foreground/60 list-disc pl-4">
          {config.recordRetail && (
            <li>
              <span className="font-bold">Retail:</span>{' '}
              <code>{config.retailLogPath}</code>
            </li>
          )}
          {config.recordClassic && (
            <li>
              <span className="font-bold">Classic:</span>{' '}
              <code>{config.classicLogPath}</code>
            </li>
          )}
        </ul>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          <span className="font-bold">Tip</span>: If recordings do not start,
          check your logging settings in-game and confirm your log path
          configuration is correct.
        </p>
      </div>
    ),
    [RecStatus.FatalError]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          Warcraft Recorder has hit a fatal error
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          Please try to resolve the error below, then restart the application.
        </p>
        <p className="text-xs text-error-text">{error}</p>
        <p className="text-xs text-popover-foreground/60">
          If this problem is recurring, please ask for help in Discord. See the
          pins in the #help channel for advice on getting help.
        </p>
      </div>
    ),
    [RecStatus.Overrunning]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">Overrunning ...</h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          Warcraft Recorder has detected an activity has completed successfuly
          and is recording a few seconds extra to catch the aftermath.
        </p>
      </div>
    ),
    [RecStatus.Reconfiguring]: undefined,
  };

  const statusLightsClasses = 'w-1.5 h-full rounded-l-md rounded-r-none';

  const { statusTitle, statusIndicatorVariant, statusDescription }: StatusInfo =
    {
      statusTitle: RecStatusTitle[status],
      statusIndicatorVariant: RecStatusVariants[status],
      statusDescription: RecStatusDescription[status],
    };

  const [uploadProgress, setUploadProgress] = React.useState<number | false>(
    false
  );
  const [downloadProgress, setDownloadProgress] = React.useState<
    number | false
  >(false);

  React.useEffect(() => {
    const ipc = window.electron.ipcRenderer;

    ipc.on('updateUploadProgress', (progress) => {
      if (!progress || progress === 100) {
        setTimeout(() => setUploadProgress(false), 1000);
      }
      setUploadProgress(progress as number);
    });

    ipc.on('updateDownloadProgress', (progress) => {
      console.log('updateDownloadProgress called');
      if (!progress || progress === 100) {
        setTimeout(() => setDownloadProgress(false), 1000);
      }
      setDownloadProgress(progress as number);
    });
  }, []);

  const isSaving = savingStatus === SaveStatus.Saving;
  const isUpDowning = uploadProgress !== false || downloadProgress !== false;

  return (
    <div className="w-full h-full flex relative rounded-md border-t border-[rgba(255,255,255,10%)]">
      <StatusLight
        wrapperClasses={`${statusLightsClasses}`}
        foregroundClasses={`border-none ${statusLightsClasses}`}
        variant={statusIndicatorVariant}
      />
      <div className="ml-4 py-2 font-sans flex flex-col justify-around">
        <span className="text-foreground-lighter/80 font-bold text-xs drop-shadow-sm">
          Status
        </span>
        <HoverCard openDelay={300}>
          <HoverCardTrigger>
            <span
              className={cn(
                'text-foreground-lighter font-semibold text-sm transition-all',
                { 'cursor-pointer hover:opacity-75': !!statusDescription }
              )}
            >
              {statusTitle}
            </span>
          </HoverCardTrigger>
          {!!statusDescription && (
            <HoverCardContent className="w-80">
              {statusDescription}
            </HoverCardContent>
          )}
        </HoverCard>
        {(isSaving || isUpDowning) && (
          <div className="flex text-foreground-lighter/80 font-bold text-[11px] drop-shadow-sm gap-x-1 items-center">
            {isSaving && (
              <>
                <HardDriveDownload size={14} />
                {isUpDowning && <Separator orientation="vertical" />}
              </>
            )}
            {isUpDowning && (
              <>
                <>
                  {downloadProgress !== false && (
                    <>
                      <CloudDownload size={14} /> {downloadProgress.toFixed(0)}%
                    </>
                  )}
                </>
                {downloadProgress !== false && uploadProgress !== false && (
                  <Separator orientation="vertical" />
                )}
                <>
                  {uploadProgress !== false && (
                    <>
                      <CloudUpload size={14} /> {uploadProgress.toFixed(0)}%
                    </>
                  )}
                </>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Status;
