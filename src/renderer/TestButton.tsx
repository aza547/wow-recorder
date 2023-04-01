import { Button, Tooltip } from '@mui/material';
import BiotechIcon from '@mui/icons-material/Biotech';

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
    <Tooltip title="Test">
      <Button
        id="test-button"
        type="button"
        onClick={runTest}
        sx={{ padding: '2px', minWidth: '25px' }}
      >
        <BiotechIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
      </Button>
    </Tooltip>
  );
}
