import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/types';
import { CloudDownload, CloudUpload, HardDriveDownload } from 'lucide-react';
import { ConfigurationSchema } from 'config/configSchema';
import { AppState, RecStatus, SaveStatus } from 'main/types';
import React, { useRef } from 'react';
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

type StatusInfo = {
  statusTitle: string;
  statusIndicatorVariant: StatusLightProps['variant'];
  statusDescription: React.ReactNode | undefined;
};

type StatusProps = {
  status: RecStatus;
  error: string;
  savingStatus: SaveStatus;
  config: ConfigurationSchema;
  appState: AppState;
};

const Status = ({
  status,
  error,
  savingStatus,
  config,
  appState,
}: StatusProps) => {
  const stopRecording = () => {
    window.electron.ipcRenderer.sendMessage('recorder', ['stop']);
  };

  const getConfiguredFlavours = () => {
    const flavours: string[] = [];

    if (config.recordRetail) {
      const s = getLocalePhrase(appState.language, Phrase.Retail);
      flavours.push(s);
    }

    if (config.recordClassic) {
      const s = getLocalePhrase(appState.language, Phrase.Classic);
      flavours.push(s);
    }

    if (config.recordEra) {
      const s = getLocalePhrase(appState.language, Phrase.Era);
      flavours.push(s);
    }

    if (flavours.length > 0) {
      return `${flavours.join(', ')}.`;
    }

    return getLocalePhrase(appState.language, Phrase.StatusDescriptionNothing);
  };

  // The short recording status descriptor used on the status card
  const RecStatusTitle: Record<RecStatus, string> = {
    [RecStatus.Recording]: getLocalePhrase(
      appState.language,
      Phrase.StatusTitleRecording,
    ),
    [RecStatus.WaitingForWoW]: getLocalePhrase(
      appState.language,
      Phrase.StatusTitleWaiting,
    ),
    [RecStatus.InvalidConfig]: getLocalePhrase(
      appState.language,
      Phrase.StatusTitleInvalid,
    ),
    [RecStatus.ReadyToRecord]: getLocalePhrase(
      appState.language,
      Phrase.StatusTitleReady,
    ),
    [RecStatus.FatalError]: getLocalePhrase(
      appState.language,
      Phrase.StatusTitleFatalError,
    ),
    [RecStatus.Overrunning]: getLocalePhrase(
      appState.language,
      Phrase.StatusTitleOverrunning,
    ),
    [RecStatus.Reconfiguring]: getLocalePhrase(
      appState.language,
      Phrase.StatusTitleReconfiguring,
    ),
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
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionRecording,
          )}
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(appState.language, Phrase.StatusDescriptionForceEnd)}
        </p>
        <div className="flex w-full justify-end">
          <Button size="sm" onClick={stopRecording} className="mt-2 w-1/3">
            {getLocalePhrase(
              appState.language,
              Phrase.StatusButtonForceEndLabel,
            )}
          </Button>
        </div>
      </div>
    ),
    [RecStatus.WaitingForWoW]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          {getLocalePhrase(appState.language, Phrase.StatusDescriptionWaiting)}
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionConfiguredToRecord,
          )}{' '}
          {getConfiguredFlavours()}
        </p>
      </div>
    ),
    [RecStatus.InvalidConfig]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionMisconfigured,
          )}
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionPleaseResolve,
          )}
        </p>
        <p className="text-xs text-error-text">{error}</p>
      </div>
    ),
    [RecStatus.ReadyToRecord]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionDetectedRunning,
          )}
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionWatchingLogs,
          )}
          {': '}
        </p>
        <ul className="text-xs text-popover-foreground/60 list-disc pl-4">
          {config.recordRetail && (
            <li>
              <span className="font-bold">
                {getLocalePhrase(appState.language, Phrase.Retail)}
                {': '}
              </span>
              <code>{config.retailLogPath}</code>
            </li>
          )}
          {config.recordClassic && (
            <li>
              <span className="font-bold">
                {getLocalePhrase(appState.language, Phrase.Classic)}
                {': '}
              </span>
              <code>{config.classicLogPath}</code>
            </li>
          )}
          {config.recordEra && (
            <li>
              <span className="font-bold">
                {getLocalePhrase(appState.language, Phrase.Era)}
                {': '}
              </span>
              <code>{config.eraLogPath}</code>
            </li>
          )}
        </ul>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          <span className="font-bold">
            {getLocalePhrase(appState.language, Phrase.StatusDescriptionTip)}
            {': '}
          </span>
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionIfNoRecording,
          )}
        </p>
      </div>
    ),
    [RecStatus.FatalError]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionFatalError,
          )}
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionPleaseResolve,
          )}
        </p>
        <p className="text-xs text-error-text">{error}</p>
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionIfRecurring,
          )}
        </p>
      </div>
    ),
    [RecStatus.Overrunning]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">Overrunning ...</h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(
            appState.language,
            Phrase.StatusDescriptionOverrunning,
          )}
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
    false,
  );
  const [downloadProgress, setDownloadProgress] = React.useState<
    number | false
  >(false);

  const clearUploadProgressTimer = useRef<NodeJS.Timeout | null>(null);
  const clearDownloadProgressTimer = useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const ipc = window.electron.ipcRenderer;

    ipc.on('updateUploadProgress', (progress) => {
      if (clearUploadProgressTimer.current) {
        clearTimeout(clearUploadProgressTimer.current);
      }

      if (progress === null || progress === undefined || progress === 100) {
        clearUploadProgressTimer.current = setTimeout(
          () => setUploadProgress(false),
          1000,
        );
      }

      setUploadProgress(progress as number);
    });

    ipc.on('updateDownloadProgress', (progress) => {
      if (clearDownloadProgressTimer.current) {
        clearTimeout(clearDownloadProgressTimer.current);
      }

      if (progress === null || progress === undefined || progress === 100) {
        clearDownloadProgressTimer.current = setTimeout(
          () => setDownloadProgress(false),
          1000,
        );
      }

      setDownloadProgress(progress as number);
    });

    return () => {
      ipc.removeAllListeners('updateUploadProgress');
      ipc.removeAllListeners('updateDownloadProgress');
    };
  }, []);

  const isSaving = savingStatus === SaveStatus.Saving;
  const isUpDowning = uploadProgress !== false || downloadProgress !== false;

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger>
        <div className="w-full h-full flex relative rounded-md border-t border-[rgba(255,255,255,10%)] hover:cursor-pointer">
          <StatusLight
            wrapperClasses={`${statusLightsClasses}`}
            foregroundClasses={`border-none ${statusLightsClasses}`}
            variant={statusIndicatorVariant}
          />
          <div className="ml-4 py-2 font-sans flex flex-col justify-around">
            <span className="text-foreground-lighter font-bold text-xs drop-shadow-sm opacity-60 hover:text-foreground-lighter">
              {getLocalePhrase(appState.language, Phrase.StatusHeading)}
            </span>

            <span
              className={cn(
                'text-popover-foreground font-semibold text-sm transition-all hover:text-popover-foreground',
                { '': !!statusDescription },
              )}
            >
              {statusTitle}
            </span>

            {(isSaving || isUpDowning) && (
              <div className="flex text-foreground-lighter font-bold text-[11px] drop-shadow-sm gap-x-1 items-center hover:text-foreground-lighter">
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
                          <CloudDownload size={14} />{' '}
                          {downloadProgress.toFixed(0)}%
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
        {!!statusDescription && (
          <HoverCardContent className="w-80 mx-4">
            {statusDescription}
          </HoverCardContent>
        )}
      </HoverCardTrigger>
    </HoverCard>
  );
};

export default Status;
