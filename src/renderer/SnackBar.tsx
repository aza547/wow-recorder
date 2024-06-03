import * as React from 'react';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { SnackbarContent } from '@mui/material';

interface IProps {
  message: string;
  timeout: number;
  open: boolean;
  color: string;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function SnackBar(props: IProps) {
  const { message, timeout, open, setOpen, color } = props;

  const handleClose = (
    _event: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpen(false);
  };

  const action = (
    <>
      <IconButton
        size="small"
        aria-label="close"
        color="inherit"
        onClick={handleClose}
      >
        <CloseIcon fontSize="small" sx={{ color: 'white' }} />
      </IconButton>
    </>
  );

  return (
    <Snackbar
      open={open}
      autoHideDuration={timeout * 1000}
      onClose={handleClose}
      sx={{
        '&.MuiSnackbar-root': { bottom: '50px' },
      }}
    >
      <SnackbarContent
        sx={{ backgroundColor: color }}
        message={message}
        action={action}
      />
    </Snackbar>
  );
}
