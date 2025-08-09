import { Box } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SceneItemPosition, SourceDimensions } from 'noobs';

const ipc = window.electron.ipcRenderer;

enum WCRSceneItem {
  OVERLAY,
  GAME,
}

const RecorderPreview = () => {
  const draggingOverlay = useRef(false);
  const draggingGame = useRef(false);

  const [previewInfo, setPreviewInfo] = useState<{
    canvasWidth: number;
    canvasHeight: number;
    previewWidth: number;
    previewHeight: number;
  }>({
    canvasWidth: 0,
    canvasHeight: 0,
    previewWidth: 0,
    previewHeight: 0,
  });

  const lastPosOverlay = useRef({ x: 0, y: 0 });
  const lastPosGame = useRef({ x: 0, y: 0 });

  const [overlayDimensions, setOverlayDimensions] = useState<
    SceneItemPosition & SourceDimensions
  >({
    x: 0,
    y: 0,
    scaleX: 0.15, // TODO: not fixed
    scaleY: 0.15, // TODO: not fixed
    width: 0,
    height: 0,
  });

  const [gameDimensions, setGameDimensions] = useState<
    SceneItemPosition & SourceDimensions
  >({
    x: 0,
    y: 0,
    scaleX: 1, // TODO: not fixed
    scaleY: 1, // TODO: not fixed
    width: 0,
    height: 0,
  });

  const updateDims = async () => {
    const dims = await ipc.getPreviewInfo();
    const overlayPosition = await ipc.getSourcePosition('WCR Overlay');
    const gamePosition = await ipc.getSourcePosition('WCR Window Capture');
    setPreviewInfo(dims);
    setOverlayDimensions(overlayPosition);
    setGameDimensions(gamePosition);
  };

  const onMouseMove = useCallback((event: MouseEvent) => {
    let src: WCRSceneItem;

    if (draggingOverlay.current) {
      src = WCRSceneItem.OVERLAY;
    } else if (draggingGame.current) {
      src = WCRSceneItem.GAME;
    } else {
      return; // Not dragging anything
    }

    const lastPos = src === WCRSceneItem.OVERLAY ? lastPosOverlay : lastPosGame;
    const deltaX = event.clientX - lastPos.current.x;
    const deltaY = event.clientY - lastPos.current.y;

    const position: SceneItemPosition = {
      x: deltaX,
      y: deltaY,
      scaleX: 0.15, // TODO: not fixed
      scaleY: 0.15, // TODO: not fixed
    };

    if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
      const toMove =
        src === WCRSceneItem.OVERLAY ? 'WCR Overlay' : 'WCR Window Capture';

      ipc.setSourcePosition(toMove, position);
      lastPos.current = { x: event.clientX, y: event.clientY };
      updateDims();
    }
  }, []);

  const onMouseUp = () => {
    console.log('onMouseUp');
    draggingGame.current = false;
    draggingOverlay.current = false;
  };

  const onMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, src: WCRSceneItem) => {
      console.log('onMouseDown for', src);

      if (src === WCRSceneItem.OVERLAY) {
        lastPosOverlay.current = { x: event.clientX, y: event.clientY };
        draggingOverlay.current = true;
      } else {
        lastPosGame.current = { x: event.clientX, y: event.clientY };
        draggingGame.current = true;
      }
    },
    [],
  );

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  let resizeObserver: ResizeObserver | undefined;

  const show = async () => {
    const previewBox = document.getElementById('preview-box');

    if (!previewBox) {
      return;
    }

    // Show the preview box and set its dimensions.
    const { width, height, x, y } = previewBox.getBoundingClientRect();
    ipc.sendMessage('preview', ['show', width, height, x, y]);

    // Update the overlay dimensions.
    updateDims();
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

  const renderDraggableSceneBox = (src: WCRSceneItem) => {
    const { x, y, width, height, scaleX, scaleY } =
      src === WCRSceneItem.OVERLAY ? overlayDimensions : gameDimensions;

    const scaledWidth = width * scaleX;
    const scaledHeight = height * scaleY;

    if (scaledWidth === 0 || scaledHeight === 0) {
      return <></>;
    }

    const sfx = previewInfo.previewWidth / previewInfo.canvasWidth;
    const sfy = previewInfo.previewHeight / previewInfo.canvasHeight;

    const xLimited = sfx < sfy;
    let xCorr = 0;
    let yCorr = 0;

    if (xLimited) {
      //console.log('xLimited');
      yCorr = (previewInfo.previewHeight - sfx * previewInfo.canvasHeight) / 2;
    } else {
      //console.log('yLimited');
      xCorr = (previewInfo.previewWidth - sfy * previewInfo.canvasWidth) / 2;
    }

    const left = x + xCorr;
    const top = y + yCorr;

    const cornerSize = 10; // Size in pixels for the corner boxes

    return (
      <Box
        id={src === WCRSceneItem.OVERLAY ? 'overlay-box' : 'game-box'}
        onMouseDown={(e) => onMouseDown(e, src)}
        sx={{
          position: 'absolute',
          left,
          top,
          height: scaledHeight,
          width: scaledWidth,
          border: '2px solid red',
          boxSizing: 'border-box',
        }}
      >
        {/* Top-left corner */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: cornerSize,
            height: cornerSize,
            backgroundColor: 'white',
            border: '1px solid gray',
            zIndex: 1,
          }}
        />
        {/* Top-right corner */}
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: cornerSize,
            height: cornerSize,
            backgroundColor: 'white',
            border: '1px solid gray',
            zIndex: 1,
          }}
        />
        {/* Bottom-left corner */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: cornerSize,
            height: cornerSize,
            backgroundColor: 'white',
            border: '1px solid gray',
            zIndex: 1,
          }}
        />
        {/* Bottom-right corner */}
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: cornerSize,
            height: cornerSize,
            backgroundColor: 'white',
            border: '1px solid gray',
            zIndex: 1,
          }}
        />
      </Box>
    );
  };

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
          position: 'relative',
          height: '100%',
          border: '2px solid black',
          boxSizing: 'border-box',
          mx: 12,
          overflow: 'hidden',
        }}
      >
        {renderDraggableSceneBox(WCRSceneItem.GAME)}
        {renderDraggableSceneBox(WCRSceneItem.OVERLAY)}
      </Box>
    </Box>
  );
};

export default RecorderPreview;
