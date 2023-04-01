import { Button, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

const ipc = window.electron.ipcRenderer;

export default function SettingsButton() {
  const openSettings = () => {
    ipc.sendMessage('settingsWindow', ['create']);
  };

  return (
    <Tooltip title="Settings">
      <Button
        id="settings-cog"
        type="button"
        onClick={openSettings}
        sx={{ padding: '2px', minWidth: '25px' }}
      >
        <SettingsIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
      </Button>
    </Tooltip>
  );
}
