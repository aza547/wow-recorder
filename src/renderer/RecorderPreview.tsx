import { Box } from '@mui/material';
import React from 'react';

const ipc = window.electron.ipcRenderer;

const RecorderPreview: React.FC = () => {
  let resizeObserver: ResizeObserver | undefined;

  const show = () => {
    const previewBox = document.getElementById('preview-box');

    if (previewBox) {
      const { width, height, x, y } = previewBox.getBoundingClientRect();
      // Random numbers here idk why but looks slightly better with the border.
      ipc.sendMessage('preview', ['show', width - 3, height - 3, x + 2, y + 2]);
    }
  };

  const cleanup = () => {
    if (resizeObserver !== undefined) {
      resizeObserver.disconnect();
    }

    ipc.sendMessage('preview', ['hide']);
  };

  const setupResizeObserver = () => {
    if (resizeObserver === undefined) {
      resizeObserver = new ResizeObserver(show);
    }

    const previewBox = document.getElementById('preview-box');

    if (previewBox !== null) {
      resizeObserver.observe(previewBox);
    }
  };

  React.useEffect(() => {
    show();
    setupResizeObserver();
    return cleanup;
  }, []);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'black',
      }}
    >
      <Box
        id="preview-box"
        sx={{
          height: '100%',
          border: '2px solid black',
          boxSizing: 'border-box',
          mx: 12,
        }}
      >
        Preview...
      </Box>
    </Box>
  );
};

export default RecorderPreview;
