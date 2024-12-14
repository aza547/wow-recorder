import { FileText } from 'lucide-react';
import { AppState } from 'main/types';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { Button } from './components/Button/Button';
import { Tooltip } from './components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
}

export default function LogsButton(props: IProps) {
  const { appState } = props;

  const openLogPath = () => {
    ipc.sendMessage('logPath', ['open']);
  };

  return (
    <Tooltip
      content={getLocalePhrase(appState.language, Phrase.LogsButtonLabel)}
      side="top"
    >
      <Button
        id="log-button"
        type="button"
        onClick={openLogPath}
        variant="ghost"
        size="icon"
      >
        <FileText size={20} />
      </Button>
    </Tooltip>
  );
}
