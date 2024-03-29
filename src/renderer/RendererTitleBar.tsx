import { Box } from '@mui/material';
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

  const [title, setTitle] = React.useState('Warcraft Recorder Pro');

  React.useEffect(() => {
    window.electron.ipcRenderer.on('updateTitleBar', (t) => {
      setTitle(t as string);
    });
  }, []);

  return (
    <Box
      id="title-bar"
      sx={{
        borderBottom: '1px solid black',
        height: '35px',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#182035',
        zIndex: 1,
      }}
    >
      <div id="logo">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </div>
      <div id="title">{title}</div>
      <div id="title-bar-btns">
        <button id="min-btn" type="button" onClick={clickedHide}>
          🗕
        </button>
        <button id="max-btn" type="button" onClick={clickedResize}>
          🗗
        </button>
        <button id="close-btn" type="button" onClick={clickedQuit}>
          ✖
        </button>
      </div>
    </Box>
  );
}
