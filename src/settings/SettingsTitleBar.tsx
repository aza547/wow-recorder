import icon from '../../assets/icons8-heart-with-mouse-48.png';

export default function TitleBar() {

  const clickedQuit = () => {
    console.log("QUIT event");
    window.electron.ipcRenderer.sendMessage('CLOSE-SETTINGS', []);
    // 
  };

  return (
    <div id="title-bar">
      <div id="logo">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </div>
      <div id="title">Warcraft Recorder</div>
      <div id="title-bar-btns">
        <button id="close-btn" onClick={clickedQuit}   >✖</button>
      </div>
    </div>
  );
}
