import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

type ConfirmationDialogProps = {
    open: boolean,
    title?: string,
    onConfirm: Function,
    onReject: Function,
    children: string,
}

export default function ConfirmationDialog(props: ConfirmationDialogProps) {
  const [open, setOpen] = React.useState(props.open);

  const handleYes = () => props.onConfirm();
  const handleNo = () => props.onReject();

  React.useEffect(() => {
    setOpen(props.open);
  }, [props.open])

  return (
    <Dialog
        open={open}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
    >
        { props.title &&
            <DialogTitle id="alert-dialog-title">
                { props.title }
            </DialogTitle>
        }
        <DialogContent>
            <DialogContentText id="alert-dialog-description">
            { props.children }
            </DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button onClick={handleNo} autoFocus> No </Button>
            <Button onClick={handleYes}> Yes </Button>
        </DialogActions>
    </Dialog>
  );
}
