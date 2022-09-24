import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

type ValidbuttonType = {
    label: string,
    action: boolean,
};

const validButtons: { [key: string]: ValidbuttonType } = {
    'yes':     { label: 'Yes',     action: true },
    'no':      { label: 'No',      action: false },
    'ok':      { label: 'OK',      action: false },
    'close':   { label: 'Close',   action: false },
    'confirm': { label: 'Confirm', action: true },
};
type ValidButtonKeyType = keyof typeof validButtons;

type ConfirmationDialogProps = {
    open: boolean,
    title?: string,
    buttons: string[],
    children?: string,
    default?: string,
    onAction?: Function,
    onClose: Function,
}

export default function InformationDialog(props: ConfirmationDialogProps) {
    const [open, setOpen] = React.useState(props.open);

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
            <Button key={'dialog-button-' + button} onClick={() => handleBtnClick(button)} autoFocus={autoFocus}>
                { validButtons[button].label }
            </Button>
        );
    };

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
                { props.buttons.map(button => renderButton(button, props.default === button || props.buttons.length == 1)) }
            </DialogActions>
        </Dialog>
    );
}
