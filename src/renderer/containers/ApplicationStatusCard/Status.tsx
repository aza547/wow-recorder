import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';
import { HardDriveDownload } from 'lucide-react';
import { ConfigurationSchema } from 'config/configSchema';
import {
  ActivityStatus,
  AdvancedLoggingStatus,
  AppState,
  RecStatus,
  SaveStatus,
} from 'main/types';
import React, { useEffect, useState } from 'react';
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
import { secToMmSs } from 'renderer/rendererutils';

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
  activityStatus: ActivityStatus | null;
  advancedLoggingStatus: AdvancedLoggingStatus | null;
};

const Status = ({
  status,
  error,
  savingStatus,
  config,
  appState,
  activityStatus,
  advancedLoggingStatus,
}: StatusProps) => {
  const { language } = appState;
  const [recTimerSec, setRecTimerSec] = useState(0);

  useEffect(() => {
    if (!activityStatus) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - activityStatus.start) / 1000);
      setRecTimerSec(elapsed);
    };

    tick();
    const id = setInterval(tick, 1000);

    return () => {
      clearInterval(id);
      setRecTimerSec(0);
    };
  }, [activityStatus]);

  const stopRecording = () => {
    window.electron.ipcRenderer.forceStopRecording();
  };

  const getConfiguredFlavours = () => {
    const flavours: string[] = [];

    if (config.recordRetail) {
      const s = getLocalePhrase(language, Phrase.Retail);
      flavours.push(s);
    }

    if (config.recordClassic) {
      const s = getLocalePhrase(language, Phrase.Classic);
      flavours.push(s);
    }

    if (config.recordEra) {
      const s = getLocalePhrase(language, Phrase.Era);
      flavours.push(s);
    }

    if (config.recordRetailPtr) {
      const s = getLocalePhrase(language, Phrase.RetailPtr);
      flavours.push(s);
    }

    if (config.recordClassicPtr) {
      const s = getLocalePhrase(language, Phrase.ClassicPtr);
      flavours.push(s);
    }

    if (flavours.length > 0) {
      return `${flavours.join(', ')}.`;
    }

    return getLocalePhrase(language, Phrase.StatusDescriptionNothing);
  };

  // The short recording status descriptor used on the status card
  const RecStatusTitle: Record<RecStatus, string> = {
    [RecStatus.Recording]: getLocalePhrase(
      language,
      Phrase.StatusTitleRecording,
    ),
    [RecStatus.WaitingForWoW]: getLocalePhrase(
      language,
      Phrase.StatusTitleWaiting,
    ),
    [RecStatus.InvalidConfig]: getLocalePhrase(
      language,
      Phrase.StatusTitleInvalid,
    ),
    [RecStatus.ReadyToRecord]: getLocalePhrase(
      language,
      Phrase.StatusTitleReady,
    ),
    [RecStatus.FatalError]: getLocalePhrase(
      language,
      Phrase.StatusTitleFatalError,
    ),
    [RecStatus.Overrunning]: getLocalePhrase(
      language,
      Phrase.StatusTitleOverrunning,
    ),
    [RecStatus.Reconfiguring]: getLocalePhrase(
      language,
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
          {getLocalePhrase(language, Phrase.StatusDescriptionRecording)}
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(language, Phrase.StatusDescriptionForceEnd)}
        </p>
        <div className="flex w-full justify-end">
          <Button size="sm" onClick={stopRecording} className="mt-2 w-1/3">
            {getLocalePhrase(language, Phrase.StatusButtonForceEndLabel)}
          </Button>
        </div>
      </div>
    ),
    [RecStatus.WaitingForWoW]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          {getLocalePhrase(language, Phrase.StatusDescriptionWaiting)}
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(
            language,
            Phrase.StatusDescriptionConfiguredToRecord,
          )}{' '}
          {getConfiguredFlavours()}
        </p>
      </div>
    ),
    [RecStatus.InvalidConfig]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          {getLocalePhrase(language, Phrase.StatusDescriptionMisconfigured)}
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(language, Phrase.StatusDescriptionPleaseResolve)}
        </p>
        <p className="text-xs text-error-text">{error}</p>
      </div>
    ),
    [RecStatus.ReadyToRecord]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          {getLocalePhrase(language, Phrase.StatusDescriptionDetectedRunning)}
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(language, Phrase.StatusDescriptionWatchingLogs)}
          {': '}
        </p>
        <ul className="text-xs text-popover-foreground/60 list-disc pl-4">
          {config.recordRetail && (
            <li>
              <span className="font-bold">
                {getLocalePhrase(language, Phrase.Retail)}
                {': '}
              </span>
              <code>{config.retailLogPath}</code>
              {advancedLoggingStatus && !advancedLoggingStatus.retail && (
                <span
                  className="text-destructive ml-1"
                  title={getLocalePhrase(
                    language,
                    Phrase.AdvancedCombatLoggingDisabledWarning,
                  )}
                >
                  {'\u26A0'}
                </span>
              )}
            </li>
          )}
          {config.recordClassic && (
            <li>
              <span className="font-bold">
                {getLocalePhrase(language, Phrase.Classic)}
                {': '}
              </span>
              <code>{config.classicLogPath}</code>
              {advancedLoggingStatus && !advancedLoggingStatus.classic && (
                <span
                  className="text-destructive ml-1"
                  title={getLocalePhrase(
                    language,
                    Phrase.AdvancedCombatLoggingDisabledWarning,
                  )}
                >
                  {'\u26A0'}
                </span>
              )}
            </li>
          )}
          {config.recordEra && (
            <li>
              <span className="font-bold">
                {getLocalePhrase(language, Phrase.Era)}
                {': '}
              </span>
              <code>{config.eraLogPath}</code>
              {advancedLoggingStatus && !advancedLoggingStatus.era && (
                <span
                  className="text-destructive ml-1"
                  title={getLocalePhrase(
                    language,
                    Phrase.AdvancedCombatLoggingDisabledWarning,
                  )}
                >
                  {'\u26A0'}
                </span>
              )}
            </li>
          )}
          {config.recordRetailPtr && (
            <li>
              <span className="font-bold">
                {getLocalePhrase(language, Phrase.RetailPtr)}
                {': '}
              </span>
              <code>{config.retailPtrLogPath}</code>
              {advancedLoggingStatus && !advancedLoggingStatus.retailPtr && (
                <span
                  className="text-destructive ml-1"
                  title={getLocalePhrase(
                    language,
                    Phrase.AdvancedCombatLoggingDisabledWarning,
                  )}
                >
                  {'\u26A0'}
                </span>
              )}
            </li>
          )}
          {config.recordClassicPtr && (
            <li>
              <span className="font-bold">
                {getLocalePhrase(language, Phrase.ClassicPtr)}
                {': '}
              </span>
              <code>{config.classicPtrLogPath}</code>
              {advancedLoggingStatus && !advancedLoggingStatus.classicPtr && (
                <span
                  className="text-destructive ml-1"
                  title={getLocalePhrase(
                    language,
                    Phrase.AdvancedCombatLoggingDisabledWarning,
                  )}
                >
                  {'\u26A0'}
                </span>
              )}
            </li>
          )}
        </ul>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          <span className="font-bold">
            {getLocalePhrase(language, Phrase.StatusDescriptionTip)}
            {': '}
          </span>
          {getLocalePhrase(language, Phrase.StatusDescriptionIfNoRecording)}
        </p>
      </div>
    ),
    [RecStatus.FatalError]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">
          {getLocalePhrase(language, Phrase.StatusDescriptionFatalError)}
        </h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(language, Phrase.StatusDescriptionPleaseResolve)}
        </p>
        <p className="text-xs text-error-text">{error}</p>
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(language, Phrase.StatusDescriptionIfRecurring)}
        </p>
      </div>
    ),
    [RecStatus.Overrunning]: (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">Overrunning ...</h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(language, Phrase.StatusDescriptionOverrunning)}
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

  const isSaving = savingStatus === SaveStatus.Saving;

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
              {getLocalePhrase(language, Phrase.StatusTitleRec)}
            </span>

            <div
              className={cn(
                'flex items-center text-popover-foreground font-semibold text-sm transition-all hover:text-popover-foreground',
                { '': !!statusDescription },
              )}
            >
              {statusTitle}
              {recTimerSec > 0 && (
                <div className="mx-2 text-foreground">
                  {secToMmSs(recTimerSec)}
                </div>
              )}
              {isSaving && (
                <HardDriveDownload size={14} className="mx-1 animate-pulse" />
              )}
            </div>
          </div>
        </div>
        {!!statusDescription && (
          <HoverCardContent className="w-[260px] mx-4">
            {statusDescription}
          </HoverCardContent>
        )}
      </HoverCardTrigger>
    </HoverCard>
  );
};

export default Status;
