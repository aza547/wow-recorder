import { Box } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { stopPropagation } from './rendererutils';

const ipc = window.electron.ipcRenderer;

enum WCRSceneItem {
  OVERLAY,
  GAME,
}

enum SceneInteraction {
  NONE,
  MOVE,
  SCALE,
}

const RecorderPreview = () => {
  const draggingOverlay = useRef<SceneInteraction>(SceneInteraction.NONE);
  const draggingGame = useRef<SceneInteraction>(SceneInteraction.NONE);
  let zIndex = 1;

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

  // const lastPosOverlay = useRef({ x: 0, y: 0 });
  // const lastPosGame = useRef({ x: 0, y: 0 });

  const [overlayBoxDimensions, setOverlayDimensions] = useState({
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  });

  const [gameBoxDimensions, setGameBoxDimensions] = useState({
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
  });

  useEffect(() => {
    ipc.moveSource('WCR Overlay', overlayBoxDimensions);
    ipc.scaleSource('WCR Overlay', overlayBoxDimensions);
  }, [overlayBoxDimensions]);

  useEffect(() => {
    ipc.moveSource('WCR Window Capture', gameBoxDimensions);
    ipc.scaleSource('WCR Window Capture', gameBoxDimensions);
  }, [gameBoxDimensions]);

  const updateDims = async () => {
    const dims = await ipc.getPreviewInfo();
    // const overlayPosition = await ipc.getSourcePosition('WCR Overlay');
    // const gamePosition = await ipc.getSourcePosition('WCR Window Capture');
    setPreviewInfo(dims);
    // setOverlayDimensions(overlayPosition);
    // setGameDimensions(gamePosition);
  };

  const onSourceMove = (event: MouseEvent, src: WCRSceneItem) => {
    if (src === WCRSceneItem.OVERLAY) {
      setOverlayDimensions((prev) => ({
        ...prev,
        x: prev.x + event.movementX,
        y: prev.y + event.movementY,
      }));
    } else {
      setGameBoxDimensions((prev) => ({
        ...prev,
        x: prev.x + event.movementX,
        y: prev.y + event.movementY,
      }));
    }
  };

  const onSourceScale = (event: MouseEvent, src: WCRSceneItem) => {
    if (src === WCRSceneItem.OVERLAY) {
      setOverlayDimensions((prev) => {
        const aspectRatio = prev.width / prev.height;
        let newWidth = prev.width + event.movementX;
        let newHeight = newWidth / aspectRatio;
        // Prevent negative or too small sizes
        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);
        return {
          ...prev,
          width: newWidth,
          height: newHeight,
        };
      });
    } else {
      setGameBoxDimensions((prev) => {
        const aspectRatio = prev.width / prev.height;
        let newWidth = prev.width + event.movementX;
        let newHeight = newWidth / aspectRatio;
        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);
        return {
          ...prev,
          width: newWidth,
          height: newHeight,
        };
      });
    }
  };

  const onMouseMove = useCallback((event: MouseEvent) => {
    if (draggingOverlay.current === SceneInteraction.MOVE) {
      onSourceMove(event, WCRSceneItem.OVERLAY);
    } else if (draggingGame.current === SceneInteraction.MOVE) {
      onSourceMove(event, WCRSceneItem.GAME);
    } else if (draggingGame.current === SceneInteraction.SCALE) {
      onSourceScale(event, WCRSceneItem.GAME);
    } else if (draggingOverlay.current === SceneInteraction.SCALE) {
      onSourceScale(event, WCRSceneItem.OVERLAY);
    }
  }, []);

  const onMouseUp = () => {
    console.log('onMouseUp');
    draggingGame.current = SceneInteraction.NONE;
    draggingOverlay.current = SceneInteraction.NONE;
  };

  const onMouseDown = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement>,
      src: WCRSceneItem,
      action: SceneInteraction,
    ) => {
      console.log('onMouseDown for', src, action);

      if (src === WCRSceneItem.OVERLAY) {
        draggingOverlay.current = action;
      } else {
        draggingGame.current = action;
      }

      stopPropagation(event);
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
    const { x, y, width, height } =
      src === WCRSceneItem.OVERLAY ? overlayBoxDimensions : gameBoxDimensions;

    const text = src === WCRSceneItem.OVERLAY ? 'Chat Overlay' : 'Game Window';

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
    const cornerSize = 25; // Size in pixels for the corner box

    return (
      <Box
        id={src === WCRSceneItem.OVERLAY ? 'overlay-box' : 'game-box'}
        onMouseDown={(e) => onMouseDown(e, src, SceneInteraction.MOVE)}
        sx={{
          position: 'absolute',
          left,
          top,
          height,
          width,
          border: '2px solid red',
          boxSizing: 'border-box',
          zIndex: ++zIndex,
        }}
      >
        <div className=" flex w-full h-full items-center justify-center bg-black text-lg text-foreground-lighter">
          {text}
        </div>
        <Box
          onMouseDown={(e) => onMouseDown(e, src, SceneInteraction.SCALE)}
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: cornerSize,
            height: cornerSize,
            border: '2px solid red',
            backgroundColor: 'red',
            zIndex,
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
          border: '2px solid grey',
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
