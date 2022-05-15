import icon from '../../assets/icons8-heart-with-mouse-48.png';

export default function TitleBar() {

  const clickedHide = () => {
    window.electron.ipcRenderer.sendMessage('HIDE', ['ping']);
  };

  const clickedResize = () => {
    window.electron.ipcRenderer.sendMessage('RESIZE', ['ping']);
  };

  const clickedQuit = () => {
    window.electron.ipcRenderer.sendMessage('QUIT', ['ping']);
  };

  return (
    <div id="title-bar">
      <div id="logo">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </div>
      <div id="title">Warcraft Recorder</div>
      <div id="title-bar-btns">
        <button id="min-btn"   onClick={clickedHide}   >🗕</button>
        <button id="max-btn"   onClick={clickedResize} >🗗</button>
        <button id="close-btn" onClick={clickedQuit}   >✖</button>
      </div>
    </div>
  );
}
