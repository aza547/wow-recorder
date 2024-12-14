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
import ControlIcon from '../../assets/icon/ctrl-icon.png';
import { Tooltip } from './components/Tooltip/Tooltip';

type DeleteDialogProps = {
  children: React.ReactNode;
  onDelete: (event: React.MouseEvent<HTMLElement>) => void;
  tooltipContent: string;
  warning?: string;
  skipPossible: boolean;
  appState: AppState;
};

const DeleteDialog = ({
  children,
  onDelete,
  tooltipContent,
  warning,
  skipPossible,
  appState,
}: DeleteDialogProps) => {
  const getWarningMessage = () => {
    return <div className="text-sm">{warning}</div>;
  };

  const getSkipMessage = () => {
    return (
      <div className="text-sm">
        {getLocalePhrase(appState.language, Phrase.Hold)}
        <img
          src={ControlIcon}
          className="h-[32px] inline-flex mx-1"
          alt="ctrlIcon"
        />
        {getLocalePhrase(appState.language, Phrase.ToSkip)}
      </div>
    );
  };
  return (
    <Dialog>
      <Tooltip content={tooltipContent}>
        <DialogTrigger asChild>{children}</DialogTrigger>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(appState.language, Phrase.AreYouSure)}
          </DialogTitle>
        </DialogHeader>
        {warning && getWarningMessage()}
        {skipPossible && getSkipMessage()}
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

DeleteDialog.defaultProps = {
  warning: '',
};

export default DeleteDialog;
