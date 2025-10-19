import { AppState, RendererVideo } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/Dialog/Dialog';
import { Button } from './components/Button/Button';
import { Phrase } from 'localisation/phrases';

type BulkTransferDialogProps = {
  children: React.ReactNode;
  inScope: RendererVideo[];
  appState: AppState;
  upload: boolean;
};

const ipc = window.electron.ipcRenderer;

const BulkTransferDialog = ({
  children,
  inScope,
  appState,
  upload,
}: BulkTransferDialogProps) => {
  const { language } = appState;

  const getMessage = () => {
    const text = upload
      ? getLocalePhrase(language, Phrase.BulkUploadDialogText)
      : getLocalePhrase(language, Phrase.BulkDownloadDialogText);

    const warning = getLocalePhrase(language, Phrase.BulkTransferWarningText);

    return (
      <div className="flex flex-col text-sm gap-y-4">
        <p>{text}</p>
        <p>{warning}</p>
      </div>
    );
  };

  const doTransfer = () => {
    inScope.forEach((rv) => {
      if (upload) {
        ipc.sendMessage('videoButton', ['upload', rv.videoSource]);
      } else {
        ipc.sendMessage('videoButton', ['download', rv]);
      }
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(appState.language, Phrase.AreYouSure)}
          </DialogTitle>
        </DialogHeader>
        {getMessage()}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">
              {getLocalePhrase(appState.language, Phrase.CancelTooltip)}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              type="submit"
              onClick={doTransfer}
              disabled={inScope.length < 1}
            >
              {upload
                ? getLocalePhrase(appState.language, Phrase.UploadButtonText) +
                  ` (${inScope.length})`
                : getLocalePhrase(
                    appState.language,
                    Phrase.DownloadButtonText,
                  ) + ` (${inScope.length})`}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkTransferDialog;
