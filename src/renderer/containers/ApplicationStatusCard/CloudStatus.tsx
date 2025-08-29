import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';
import { CloudDownload, CloudUpload, HardDriveDownload } from 'lucide-react';
import { AppState } from 'main/types';
import React from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from 'renderer/components/HoverCard/HoverCard';
import Separator from 'renderer/components/Separator/Separator';
import StatusLight from 'renderer/components/StatusLight/StatusLight';

type StatusProps = {
  appState: AppState;
};

const CloudStatus = ({ appState }: StatusProps) => {
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [downloadProgress, setDownloadProgress] = React.useState(0);

  const [queuedUploads, setQueuedUploads] = React.useState(0);
  const [queuedDownloads, setQueuedDownloads] = React.useState(0);

  React.useEffect(() => {
    const ipc = window.electron.ipcRenderer;

    ipc.on('updateUploadProgress', (progress) => {
      setUploadProgress(progress as number);
    });

    ipc.on('updateDownloadProgress', (progress) => {
      setDownloadProgress(progress as number);
    });

    ipc.on('updateDownloadQueueLength', (queued) => {
      setQueuedDownloads(queued as number);
    });

    ipc.on('updateUploadQueueLength', (queued) => {
      setQueuedUploads(queued as number);
    });

    return () => {
      ipc.removeAllListeners('updateUploadProgress');
      ipc.removeAllListeners('updateDownloadProgress');
      ipc.removeAllListeners('updateDownloadQueueLength');
      ipc.removeAllListeners('updateUploadQueueLength');
    };
  }, []);

  const isSaving = false;
  const isUpDowning = queuedUploads > 0 || queuedDownloads > 0;
  const statusLightsClasses = 'w-1.5 h-full rounded-l-md rounded-r-none';

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger>
        <div className="w-full h-full flex relative rounded-md border-t border-[rgba(255,255,255,10%)] hover:cursor-pointer">
          <StatusLight
            wrapperClasses={`${statusLightsClasses}`}
            foregroundClasses={`border-none ${statusLightsClasses}`}
            variant="ready"
          />
          <div className="ml-4 py-2 font-sans flex flex-col justify-around">
            <span className="text-foreground-lighter font-bold text-xs drop-shadow-sm opacity-60 hover:text-foreground-lighter">
              Pro
            </span>

            <span className="text-popover-foreground font-semibold text-sm transition-all hover:text-popover-foreground">
              Connected
            </span>

            {(isSaving || isUpDowning) && (
              <div className="flex text-foreground-lighter font-bold text-[11px] drop-shadow-sm gap-x-1 items-center hover:text-foreground-lighter">
                {isSaving && (
                  <>
                    <HardDriveDownload size={14} />
                    {getLocalePhrase(appState.language, Phrase.Saving)}
                    {isUpDowning && <Separator orientation="vertical" />}
                  </>
                )}
                {isUpDowning && (
                  <>
                    <>
                      {queuedDownloads > 0 && (
                        <>
                          <CloudDownload size={14} />{' '}
                          {downloadProgress.toFixed(0)}%
                          {queuedDownloads > 1 && ` (+${queuedDownloads - 1}) `}
                        </>
                      )}
                    </>
                    {queuedDownloads > 0 && queuedUploads > 0 && (
                      <Separator orientation="vertical" />
                    )}
                    <>
                      {queuedUploads > 0 && (
                        <>
                          <CloudUpload size={14} />
                          {uploadProgress.toFixed(0)}%
                          {queuedUploads > 1 && ` (+${queuedUploads - 1}) `}
                        </>
                      )}
                    </>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <HoverCardContent className="w-80 mx-4">asd</HoverCardContent>
      </HoverCardTrigger>
    </HoverCard>
  );
};

export default CloudStatus;
