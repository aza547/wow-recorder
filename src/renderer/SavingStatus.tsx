import { IconButton } from '@mui/material';
import SaveAsIcon from '@mui/icons-material/SaveAs';

export default function SavingStatus() {
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
