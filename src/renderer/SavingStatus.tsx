import { IconButton } from '@mui/material';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import { SaveStatus } from 'main/types';

interface IProps {
  savingStatus: SaveStatus;
}

export default function SavingStatus(props: IProps) {
  const { savingStatus } = props;

  if (savingStatus === SaveStatus.NotSaving) {
    return <></>;
  }

  return (
    <IconButton
      id="saving-icon"
      type="button"
      disabled
      sx={{ padding: '2px', minWidth: '25px', color: 'white' }}
    >
      <SaveAsIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
    </IconButton>
  );
}
