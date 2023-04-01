import { Button } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

const ipc = window.electron.ipcRenderer;

export default function SettingsButton() {
  const openSettings = () => {
    ipc.sendMessage('settingsWindow', ['create']);
  };

  return (
    <Button
      id="settings-cog"
      type="button"
      onClick={openSettings}
      title="Settings"
      sx={{ padding: '2px', minWidth: '25px' }}
    >
      <SettingsIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
    </Button>
  );
}
