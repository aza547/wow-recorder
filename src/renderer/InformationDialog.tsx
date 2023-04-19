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
      backgroundColor: '#1a233a',
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
  const { open, onAction, onClose, title, children, buttons } = props;
  const [isOpen, setIsOpen] = React.useState(open);
  const { classes: styles } = useStyles();

  const handleBtnClick = (button: ValidButtonKeyType) => {
    const hasButton = Object.prototype.hasOwnProperty.call(
      validButtons,
      button
    );

    if (hasButton && validButtons[button].action) {
      if (onAction) {
        onAction(button);
      }
    }

    onClose(button);
  };

  const renderButton = (button: ValidButtonKeyType, autoFocus: boolean) => {
    return (
      <Button
        color={autoFocus ? 'primary' : 'secondary'}
        key={`dialog-button-${button}`}
        onClick={() => handleBtnClick(button)}
        autoFocus={autoFocus}
      >
        {validButtons[button].label}
      </Button>
    );
  };

  React.useEffect(() => {
    setIsOpen(open);
  }, [open]);

  return (
    <Dialog
      className={styles.dialog}
      open={isOpen}
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      {title && <DialogTitle id="dialog-title">{title}</DialogTitle>}
      <DialogContent id="dialog-description">{children}</DialogContent>
      <DialogActions>
        {buttons.map((button) =>
          renderButton(button, props.default === button || buttons.length === 1)
        )}
      </DialogActions>
    </Dialog>
  );
}
