import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import { AppState } from 'main/types';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { Button } from './components/Button/Button';
import { Tooltip } from './components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
}

export default function DiscordButton(props: IProps) {
  const { appState } = props;
  const openDiscordURL = () => {
    ipc.sendMessage('openURL', ['https://discord.gg/NPha7KdjVk']);
  };

  return (
    <Tooltip
      content={getLocalePhrase(appState.language, Phrase.DiscordButtonLabel)}
      side="top"
    >
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
