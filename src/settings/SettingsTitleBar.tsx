import icon from '../../assets/icon/small-icon.png';

const ipc = window.electron.ipcRenderer;

export default function TitleBar() {
  const clickedQuit = () => {
    ipc.sendMessage('settingsWindow', ['quit']);
  };

  return (
    <div id="title-bar">
      <div id="logo">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </div>
      <div id="title">Warcraft Recorder</div>
      <div id="title-bar-btns">
        <button id="close-btn" type="button" onClick={clickedQuit}>
          ✖
        </button>
      </div>
    </div>
  );
}
