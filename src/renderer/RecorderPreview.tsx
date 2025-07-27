import { Box } from '@mui/material';
import React, { useCallback, useRef } from 'react';

const ipc = window.electron.ipcRenderer;

const RecorderPreview: React.FC = () => {
  const [dragging, setDragging] = React.useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const onMouseMove: React.MouseEventHandler = useCallback(
    (event) => {
      if (!dragging) return;
      const deltaX = event.clientX - lastPos.current.x;
      const deltaY = event.clientY - lastPos.current.y;

      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        ipc.sendMessage('updateSourcePos', [deltaX, deltaY]);
        lastPos.current = { x: event.clientX, y: event.clientY };
      }
    },
    [dragging],
  );

  const onMouseDown: React.MouseEventHandler = useCallback((event) => {
    setDragging(true);
    lastPos.current = { x: event.clientX, y: event.clientY };
  }, []);

  let resizeObserver: ResizeObserver | undefined;

  const show = () => {
    const previewBox = document.getElementById('preview-box');

    if (previewBox) {
      const { width, height, x, y } = previewBox.getBoundingClientRect();

      // Random numbers here idk why but looks slightly better with the border.
      ipc.sendMessage('preview', ['show', width, height, x, y]);
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
        onMouseDown={onMouseDown}
        onMouseUp={() => setDragging(false)}
        onMouseMove={onMouseMove}
        // onMouseEnter={console.log}
        // onMouseLeave={console.log}
        sx={{
          height: '100%',
          border: '2px solid black',
          boxSizing: 'border-box',
          mx: 12,
        }}
      />
    </Box>
  );
};

export default RecorderPreview;
