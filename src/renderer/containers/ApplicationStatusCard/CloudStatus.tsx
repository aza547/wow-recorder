import { Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { CloudDownload, CloudUpload } from 'lucide-react';
import { AppState } from 'main/types';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from 'renderer/components/HoverCard/HoverCard';
import Separator from 'renderer/components/Separator/Separator';
import StatusLight, {
  StatusLightVariant,
} from 'renderer/components/StatusLight/StatusLight';

type StatusProps = {
  appState: AppState;
};

const CloudStatus = ({ appState }: StatusProps) => {
  const {
    cloudStatus,
    language,
    queuedUploads,
    queuedDownloads,
    uploadProgress,
    downloadProgress,
  } = appState;

  const statusLightsClasses = 'w-1.5 h-full rounded-l-md rounded-r-none';

  let status: string;
  let variant: StatusLightVariant;
  let description = <></>;

  if (!cloudStatus.enabled) {
    status = getLocalePhrase(language, Phrase.StatusTitleDisconnected);
    variant = 'disconnected';

    description = (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">{status}</h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(language, Phrase.StatusDescrDisconnected)}
        </p>
      </div>
    );
  } else if (!cloudStatus.authenticated) {
    variant = 'error';
    status = getLocalePhrase(language, Phrase.StatusTitleNotAuthenticated);

    description = (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">{status}</h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(language, Phrase.StatusDescrNotAuthenticated)}
        </p>
      </div>
    );
  } else if (!cloudStatus.authorized) {
    variant = 'error';
    status = cloudStatus.guild
      ? getLocalePhrase(language, Phrase.StatusTitleNotAuthorized)
      : getLocalePhrase(language, Phrase.StatusTitleNoGuild);

    description = (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">{status}</h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {status === getLocalePhrase(language, Phrase.StatusTitleNotAuthorized)
            ? getLocalePhrase(language, Phrase.StatusDescrNotAuthorized)
            : getLocalePhrase(language, Phrase.StatusDescrNoGuild)}
        </p>
      </div>
    );
  } else {
    variant =
      appState.queuedDownloads > 0 || appState.queuedUploads > 0
        ? 'active'
        : 'connected';
    status = getLocalePhrase(language, Phrase.StatusTitleConnected);

    description = (
      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-semibold">{status}</h2>
        <Separator className="my-1" />
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(language, Phrase.StatusDescrConnected)}
        </p>
      </div>
    );
  }

  const renderUploadIcon = () => {
    if (queuedUploads < 1) return <></>;
    return (
      <div className="inline-flex gap-x-[2px] text-xs text-foreground-lighter">
        <CloudUpload size={16} />
        {uploadProgress.toFixed(0)}%
        <span className="text-[0.60rem] text-foreground mx-[2px]">
          {queuedUploads > 1 && `+${queuedUploads - 1}`}
        </span>
      </div>
    );
  };

  const renderDownloadIcon = () => {
    if (queuedDownloads < 1) return <></>;
    return (
      <div className="inline-flex gap-x-[2px] text-xs text-foreground-lighter">
        <CloudDownload size={16} />
        {downloadProgress.toFixed(0)}%
        <span className="text-[0.60rem] text-foreground mx-[2px]">
          {queuedDownloads > 1 && `+${queuedDownloads - 1}`}
        </span>
      </div>
    );
  };

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger>
        <div className="w-full h-full flex relative rounded-md border-t border-[rgba(255,255,255,10%)] hover:cursor-pointer">
          <StatusLight
            wrapperClasses={`${statusLightsClasses}`}
            foregroundClasses={`border-none ${statusLightsClasses}`}
            variant={variant}
          />
          <div className="ml-4 mr-1 py-2 font-sans flex flex-col justify-around">
            <span className="text-foreground-lighter font-bold text-xs drop-shadow-sm opacity-60 hover:text-foreground-lighter">
              {getLocalePhrase(language, Phrase.StatusTitlePro)}
            </span>

            <span className="text-popover-foreground font-semibold text-sm transition-all hover:text-popover-foreground whitespace-nowrap overflow-hidden text-ellipsis">
              {status}
            </span>
          </div>
          <div className="flex flex-col w-full my-[8px] ml-2 mr-10 items-start justify-end text-popover-foreground font-semibold text-sm transition-all hover:text-popover-foreground gap-y-[2px]">
            {renderDownloadIcon()}
            {renderUploadIcon()}
          </div>
        </div>
        <HoverCardContent className="w-[260px] mx-4">
          {description}
        </HoverCardContent>
      </HoverCardTrigger>
    </HoverCard>
  );
};

export default CloudStatus;
