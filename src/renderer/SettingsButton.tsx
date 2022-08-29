import icon from '../../assets/icon/settings-icon.png';

const ipc = window.electron.ipcRenderer;

export default function SettingsButton() {

  const openSettings = () => {
    ipc.sendMessage('settingsWindow', ['create']);
  };

  return (
    <div id="settings">
      <button id="settings-cog" onClick={openSettings} title="Settings">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </button>
    </div>
  );
}
