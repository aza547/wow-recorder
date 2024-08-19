import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import { Button } from './components/Button/Button';
import { Tooltip } from './components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

export default function DiscordButton() {
  const openDiscordURL = () => {
    ipc.sendMessage('openURL', ['https://discord.gg/NPha7KdjVk']);
  };

  return (
    <Tooltip content="Discord" side="top">
      <Button
        id="discord-button"
        type="button"
        onClick={openDiscordURL}
        variant="ghost"
        size="icon"
      >
        <FontAwesomeIcon icon={faDiscord} size="lg" />
      </Button>
    </Tooltip>
  );
}
