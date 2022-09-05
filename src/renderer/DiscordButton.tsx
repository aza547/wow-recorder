import icon from '../../assets/icon/discord-icon.png';

const ipc = window.electron.ipcRenderer;

export default function DiscordButton() {

  const openDiscordURL = () => {
    ipc.sendMessage('openURL', ['https://discord.gg/NPha7KdjVk']);
  };

  return (
    <div id="discord-button-div">
      <button id="discord-button" onClick={openDiscordURL} title="Join the discussion on Discord">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </button>
    </div>
  );
}
