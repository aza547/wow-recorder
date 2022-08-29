import icon from '../../assets/icon/log-icon.png';

const ipc = window.electron.ipcRenderer;

export default function SettingsButton() {

  const openLogPath = () => {
    ipc.sendMessage('logPath', ['open']);
  };

  return (
    <div id="log-button-div">
      <button id="log-button" onClick={openLogPath} title="App logs">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </button>
    </div>
  );
}
