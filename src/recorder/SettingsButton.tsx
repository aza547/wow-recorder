import icon from '../../assets/icons8-settings.svg';

export default function SettingsButton() {

  const openSettings = () => {
   console.log("openening settings");
   window.electron.ipcRenderer.sendMessage('CREATE-SETTINGS', ['open']);
  };

  return (
    <div id="settings">
      <button id="settings-cog" onClick={openSettings}>
        <img alt="icon" src={icon} height="25px" width="25px" />
      </button>
    </div>
  );
}
