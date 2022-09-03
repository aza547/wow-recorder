import icon from '../../assets/icon/test-icon.png';

const ipc = window.electron.ipcRenderer;

export default function TestButton() {

  const runTest = () => {
    ipc.sendMessage('test', []);
  };

  return (
    <div id="test-button-div">
      <button id="test-button" onClick={runTest} title="Run a test">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </button>
    </div>
  );
}
