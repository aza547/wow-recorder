import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPatreon } from '@fortawesome/free-brands-svg-icons';
import { AppState } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { Button } from './components/Button/Button';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Phrase } from 'localisation/phrases';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
}

export default function PatreonButton(props: IProps) {
  const { appState } = props;
  const openPatreonURL = () => {
    ipc.sendMessage('openURL', ['https://www.patreon.com/WarcraftRecorder']);
  };

  return (
    <Tooltip
      content={getLocalePhrase(appState.language, Phrase.PatreonButtonLabel)}
      side="top"
    >
      <Button
        id="patreon-button"
        type="button"
        onClick={openPatreonURL}
        variant="ghost"
        size="icon"
      >
        <FontAwesomeIcon icon={faPatreon} size="lg" />
      </Button>
    </Tooltip>
  );
}
