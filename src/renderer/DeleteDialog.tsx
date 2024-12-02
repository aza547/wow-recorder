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
};

const DeleteDialog = ({
  children,
  onDelete,
  tooltipContent,
  warning,
  skipPossible,
}: DeleteDialogProps) => {
  const getWarningMessage = () => {
    return <div className="text-sm">{warning}</div>;
  };

  const getSkipMessage = () => {
    return (
      <div className="text-sm">
        Hold{' '}
        <img
          src={ControlIcon}
          className="h-[32px] inline-flex mx-1"
          alt="ctrlIcon"
        />{' '}
        to skip this prompt.
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
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogHeader>
        {warning && getWarningMessage()}
        {skipPossible && getSkipMessage()}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" type="submit" onClick={onDelete}>
              Delete
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
