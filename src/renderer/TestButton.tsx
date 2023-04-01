import { Button } from '@mui/material';
import icon from '../../assets/icon/test-icon.png';
import BugReportIcon from '@mui/icons-material/BugReport';

const ipc = window.electron.ipcRenderer;

export default function TestButton() {
  const runTest = (event: any) => {
    // 'Click' will perform a normal test
    // 'Ctrl-Alt-Click' will initiate a test but won't finish it
    // and requires a force stop of the recording.
    const endTest = !(event.ctrlKey && event.altKey);
    ipc.sendMessage('test', [endTest]);
  };

  return (
    <Button
      id="test-button"
      type="button"
      onClick={runTest}
      title="Test"
      sx={{ padding: '2px', minWidth: '25px' }}
    >
      <BugReportIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
    </Button>
  );
}
