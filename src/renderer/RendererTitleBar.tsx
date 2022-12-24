import React from 'react';
import icon from '../../assets/icon/small-icon.png';

const ipc = window.electron.ipcRenderer;

export default function RendererTitleBar() {
  const clickedHide = () => {
    ipc.sendMessage('mainWindow', ['minimize']);
  };

  const clickedResize = () => {
    ipc.sendMessage('mainWindow', ['resize']);
  };

  const clickedQuit = () => {
    ipc.sendMessage('mainWindow', ['quit']);
  };

  const [title, setTitle] = React.useState('Warcraft Recorder');

  React.useEffect(() => {
    window.electron.ipcRenderer.on('updateTitleBar', (title) => {
      setTitle(title as string);
    });
  }, []);

  return (
    <div id="title-bar">
      <div id="logo">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </div>
      <div id="title">{title}</div>
      <div id="title-bar-btns">
        <button id="min-btn" onClick={clickedHide}>
          🗕
        </button>
        <button id="max-btn" onClick={clickedResize}>
          🗗
        </button>
        <button id="close-btn" onClick={clickedQuit}>
          ✖
        </button>
      </div>
    </div>
  );
}
