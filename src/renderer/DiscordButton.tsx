import { Button } from '@mui/material';
import icon from '../../assets/icon/discord-icon.png';

const ipc = window.electron.ipcRenderer;

export default function DiscordButton() {
  const openDiscordURL = () => {
    ipc.sendMessage('openURL', ['https://discord.gg/NPha7KdjVk']);
  };

  return (
    <Button
      id="log-button"
      type="button"
      onClick={openDiscordURL}
      title="Logs"
      sx={{ padding: '2px', minWidth: '25px' }}
    >
      <img alt="icon" src={icon} height="25px" width="25px" />
    </Button>
  );
}
