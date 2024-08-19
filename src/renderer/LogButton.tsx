import { FileText } from 'lucide-react';
import { Button } from './components/Button/Button';
import { Tooltip } from './components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

export default function LogsButton() {
  const openLogPath = () => {
    ipc.sendMessage('logPath', ['open']);
  };

  return (
    <Tooltip content="Logs" side="top">
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
