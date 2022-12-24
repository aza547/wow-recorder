import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { makeStyles } from 'tss-react/mui';

type ValidbuttonType = {
  label: string;
  action: boolean;
};

const validButtons: { [key: string]: ValidbuttonType } = {
  confirm: { label: 'Confirm', action: true },
  yes: { label: 'Yes', action: true },
  quit: { label: 'Quit', action: true },
  no: { label: 'No', action: false },
  ok: { label: 'OK', action: false },
  close: { label: 'Close', action: false },
};
type ValidButtonKeyType = keyof typeof validButtons;

type ConfirmationDialogProps = {
  open: boolean;
  title?: string;
  buttons: string[];
  children?: React.ReactElement | React.ReactElement[];
  default?: string;
  onAction?: Function;
  onClose: Function;
};

/**
 * Styles needed to make the dialog look similar to the rest of the app
 */
const useStyles = makeStyles()({
  dialog: {
    '.MuiDialog-paper': {
      backgroundColor: '#272e48',
      maxHeight: '750px',
      maxWidth: '1250px',
      color: 'white',
      '.MuiTypography-root': {
        color: 'white',
      },
      a: {
        color: '#ffa78e',
        '&:hover': {
          textDecoration: 'underline',
        },
      },
      '.MuiDialogContent-root': {
        padding: '10px 25px',
      },
      '.MuiDialogContentText-root': {
        padding: '0px 0px',
      },
      '.MuiDialogActions-root': {
        '.MuiButton-textPrimary': {
          color: 'white',
        },
        '.MuiButton-textSecondary': {
          color: '#ffa78e',
        },
      },
    },
  },
});

export default function InformationDialog(props: ConfirmationDialogProps) {
  const [open, setOpen] = React.useState(props.open);
  const { classes: styles } = useStyles();

  const handleBtnClick = (button: ValidButtonKeyType) => {
    if (validButtons.hasOwnProperty(button) && validButtons[button].action) {
      if (props.onAction) {
        props?.onAction(button);
      }
    }

    props.onClose(button);
  };

  const renderButton = (button: ValidButtonKeyType, autoFocus: boolean) => {
    return (
      <Button
        color={autoFocus ? 'primary' : 'secondary'}
        key={'dialog-button-' + button}
        onClick={() => handleBtnClick(button)}
        autoFocus={autoFocus}
      >
        {validButtons[button].label}
      </Button>
    );
  };

  React.useEffect(() => {
    setOpen(props.open);
  }, [props.open]);

  return (
    <Dialog
      className={styles.dialog}
      open={open}
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      {props.title && (
        <DialogTitle id="dialog-title">{props.title}</DialogTitle>
      )}
      <DialogContent id="dialog-description">{props.children}</DialogContent>
      <DialogActions>
        {props.buttons.map((button) =>
          renderButton(
            button,
            props.default === button || props.buttons.length == 1
          )
        )}
      </DialogActions>
    </Dialog>
  );
}
