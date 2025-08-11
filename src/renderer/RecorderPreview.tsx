import { Box } from '@mui/material';
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
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

type BoxDimensions = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const RecorderPreview = (props: {
  previewEnabled: boolean;
  overlayBoxDimensions: BoxDimensions;
  setOverlayDimensions: Dispatch<SetStateAction<BoxDimensions>>;
  gameBoxDimensions: BoxDimensions;
  setGameBoxDimensions: Dispatch<SetStateAction<BoxDimensions>>;
}) => {
  const {
    previewEnabled,
    overlayBoxDimensions,
    setOverlayDimensions,
    gameBoxDimensions,
    setGameBoxDimensions,
  } = props;

  const draggingOverlay = useRef<SceneInteraction>(SceneInteraction.NONE);
  const draggingGame = useRef<SceneInteraction>(SceneInteraction.NONE);
  let zIndex = 1;
  let resizeObserver: ResizeObserver | undefined;

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

  useEffect(() => {
    // The overlay box has been moved or scaled, inform the backend.
    ipc.setSourcePosition('WCR Overlay', overlayBoxDimensions);
  }, [overlayBoxDimensions]);

  useEffect(() => {
    // The game box has been moved or scaled, inform the backend.
    ipc.setSourcePosition('WCR Window Capture', gameBoxDimensions);
  }, [gameBoxDimensions]);

  useEffect(() => {
    if (previewEnabled) {
      show();
    } else {
      ipc.sendMessage('preview', ['hide']);
    }
  }, [previewEnabled]);

  const updatePreviewDimensions = async () => {
    const dims = await ipc.getPreviewInfo();
    setPreviewInfo(dims);
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
        newWidth = Math.max(20, newWidth); // Prevent negative or too small sizes
        const newHeight = newWidth / aspectRatio;

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
        newWidth = Math.max(20, newWidth); // Prevent negative or too small sizes
        const newHeight = newWidth / aspectRatio;

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

  const show = async () => {
    const previewBox = document.getElementById('preview-box');

    if (previewBox && previewEnabled) {
      // Show the preview box and set its dimensions.
      const { width, height, x, y } = previewBox.getBoundingClientRect();
      ipc.sendMessage('preview', ['show', width, height, x, y]);
    }

    // Update the overlay dimensions.
    updatePreviewDimensions();
  };

  const cleanup = () => {
    if (resizeObserver !== undefined) {
      resizeObserver.disconnect();
    }

    ipc.sendMessage('preview', ['hide']);
  };

  const setupResizeObserver = () => {
    if (resizeObserver === undefined) {
      resizeObserver = new ResizeObserver(() => show());
    }

    const previewBox = document.getElementById('preview-box');

    if (previewBox !== null) {
      resizeObserver.observe(previewBox);
    }
  };

  useEffect(() => {
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
      yCorr = (previewInfo.previewHeight - sfx * previewInfo.canvasHeight) / 2;
    } else {
      xCorr = (previewInfo.previewWidth - sfy * previewInfo.canvasWidth) / 2;
    }

    const left = x + xCorr;
    const top = y + yCorr;
    const cornerSize = 25; // Size in pixels for the corner box

    if (src !== WCRSceneItem.OVERLAY) {
      console.log('Game window position:', left, top, width, height);
    }

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
          outline: '2px solid red',
          outlineOffset: '-3px', // Slight offset to save it showing up on the edges.
          zIndex: ++zIndex,
        }}
      >
        <div className="flex w-full h-full items-center justify-center bg-black text-lg text-foreground-lighter">
          {text}
        </div>
        <Box
          onMouseDown={(e) => onMouseDown(e, src, SceneInteraction.SCALE)}
          sx={{
            position: 'absolute',
            right: 1, // Slight offset to save it showing up on the edges.
            bottom: 1, // Slight offset to save it showing up on the edges.
            width: cornerSize,
            height: cornerSize,
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
          mx: 12,
          overflow: 'hidden',
          border: '1px solid black ',
        }}
      >
        {renderDraggableSceneBox(WCRSceneItem.GAME)}
        {renderDraggableSceneBox(WCRSceneItem.OVERLAY)}
      </Box>
    </Box>
  );
};

export default RecorderPreview;
