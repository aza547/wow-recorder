import icon from '../../assets/icon/test-icon.png';

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
    <div id="test-button-div">
      <button id="test-button" onClick={runTest} title="Run a test">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </button>
    </div>
  );
}
