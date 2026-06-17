import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/Dialog/Dialog';
import { Button } from './components/Button/Button';
import { ReactNode, useState } from 'react';
import { AppState } from 'main/types';
import { ExternalLink, FileText, Package } from 'lucide-react';
import Spinner from './components/Spinner/Spinner';
import { Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';

type IProps = {
  children: ReactNode;
  appState: AppState;
};

const ipc = window.electron.ipcRenderer;

const openLogPath = () => {
  ipc.sendMessage('logPath', ['open']);
};

const DiagnosticsDialog = (props: IProps) => {
  const { children, appState } = props;
  const { language } = appState;
  const [open, setOpen] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [bundlePath, setBundlePath] = useState('');

  const renderOpenLogFolder = () => {
    return (
      <Button
        id="log-button"
        type="button"
        onClick={openLogPath}
        variant="outline"
      >
        <FileText size={20} className="mr-2" />
        {getLocalePhrase(language, Phrase.DiagnosticsOpenLogButton)}
      </Button>
    );
  };

  const createDiagsBundle = async () => {
    setZipping(true);

    try {
      const bundlePath = await ipc.createDiagsBundle();
      setBundlePath(bundlePath);
    } catch (error) {
      console.error('Failed to create diagnostics bundle:', error);
      throw error;
    } finally {
      setZipping(false);
    }
  };

  const openBundleLocation = () => {
    ipc.openSystemExplorer(bundlePath);
  };

  const renderCreateDiagsBundle = () => {
    return (
      <Button
        id="create-diags-button"
        type="button"
        onClick={createDiagsBundle}
        variant={zipping ? 'outline' : 'default'}
        disabled={zipping}
      >
        {zipping ? (
          <>
            <Spinner size={'20px'} className="pr-2" />
            {getLocalePhrase(language, Phrase.DiagnosticsZippingInProgress)}
          </>
        ) : (
          <>
            <Package size={20} className="mr-2" />
            {getLocalePhrase(language, Phrase.DiagnosticsCreateBundleButton)}
          </>
        )}
      </Button>
    );
  };

  const renderOpenBundleLocation = () => {
    return (
      <Button
        id="open-bundle-location-button"
        type="button"
        onClick={openBundleLocation}
      >
        <ExternalLink size={20} className="mr-2" />
        {getLocalePhrase(language, Phrase.DiagnosticsOpenBundleCreated)}
      </Button>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (open) {
          setZipping(false);
          setBundlePath('');
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Diagnostics</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-foreground">
          {getLocalePhrase(language, Phrase.DiagnosticsDialogDescription)}
        </p>

        <div className="flex flex-row items-start gap-4 w-full items-center justify-center">
          {renderOpenLogFolder()}
          {bundlePath ? renderOpenBundleLocation() : renderCreateDiagsBundle()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DiagnosticsDialog;
