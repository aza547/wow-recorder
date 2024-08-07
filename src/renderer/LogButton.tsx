import { Button, Tooltip } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';

const ipc = window.electron.ipcRenderer;

export default function SettingsButton() {
  const openLogPath = () => {
    ipc.sendMessage('logPath', ['open']);
  };

  return (
    <Tooltip title="Logs">
      <Button
        id="log-button"
        type="button"
        onClick={openLogPath}
        sx={{ padding: '2px', minWidth: '25px' }}
      >
        <DescriptionIcon
          sx={{ width: '25px', height: '25px', color: 'white' }}
        />
      </Button>
    </Tooltip>
  );
}
