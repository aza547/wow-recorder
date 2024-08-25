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
  open: boolean;
  onOpenChange: (state: boolean) => void;
  onDelete: (event: React.MouseEvent<HTMLElement>) => void;
  tooltipContent: string;
};

const DeleteDialog = ({
  children,
  open,
  onOpenChange,
  onDelete,
  tooltipContent,
}: DeleteDialogProps) => {
  console.log(tooltipContent, onDelete);
  return (
    <Dialog>
      <Tooltip content={tooltipContent}>
        <DialogTrigger asChild>{children}</DialogTrigger>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          Hold{' '}
          <img
            src={ControlIcon}
            className="h-[32px] inline-flex mx-1"
            alt="ctrlIcon"
          />{' '}
          to skip this prompt.
        </div>
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

export default DeleteDialog;
