import { AppState } from 'main/types';
import { getLocalePhrase, Phrase } from 'localisation/translations';
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

type DeleteDialogProps = {
  children: React.ReactNode;
  onDelete: (event: React.MouseEvent<HTMLElement>) => void;
  warning?: string;
  appState: AppState;
};

const DeleteDialog = ({
  children,
  onDelete,
  warning = '',
  appState,
}: DeleteDialogProps) => {
  const getWarningMessage = () => {
    return <div className="text-sm">{warning}</div>;
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
        {warning && getWarningMessage()}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">
              {getLocalePhrase(appState.language, Phrase.CancelTooltip)}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" type="submit" onClick={onDelete}>
              {getLocalePhrase(appState.language, Phrase.DeleteButtonTooltip)}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteDialog;
