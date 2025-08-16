import { Box } from '@mui/material';
import React, {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { stopPropagation } from './rendererutils';
import { VideoSourceName } from 'main/types';

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
  redrawDraggableBoxes: MutableRefObject<() => void>;
}) => {
  const { previewEnabled, redrawDraggableBoxes } = props;

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

  const [overlayBoxDimensions, setOverlayBoxDimensions] =
    useState<BoxDimensions>({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });

  const [gameBoxDimensions, setGameBoxDimensions] = useState<BoxDimensions>({
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
  });

  useEffect(() => {
    // On component mount, get the source dimensions from the backend
    // to initialize the draggable boxes.
    configureDraggableBoxes();

    // Setup the callback for the SceneEditor function reset functions.
    redrawDraggableBoxes.current = configureDraggableBoxes;

    // Listen on the document for mouse events other than mousedown,
    // so that if the cursor goes outwith the draggable area, we can
    // still capture the events.
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    configurePreview();
    showPreview();
    setupResizeObserver();

    return () => {
      // Remove the mouse event listeners.
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Disconnect the resize observer.
      cleanupResizeObserver();

      // Hide the preview itself, we're tabbing away.
      hidePreview();
    };
  }, []);

  useEffect(() => {
    if (previewEnabled) {
      showPreview();
    } else {
      hidePreview();
    }
  }, [previewEnabled]);

  const configureDraggableBoxes = async () => {
    const display = await ipc.getDisplayInfo();
    const chat = await ipc.getSourcePosition(VideoSourceName.OVERLAY);
    const game = await ipc.getSourcePosition(VideoSourceName.WINDOW);
    setPreviewInfo(display);
    setOverlayBoxDimensions(chat);
    setGameBoxDimensions(game);
  };

  const showPreview = () => {
    ipc.showPreview();
  };

  const hidePreview = () => {
    ipc.hidePreview();
  };

  const configurePreview = async () => {
    const previewBox = document.getElementById('preview-box');

    if (previewBox) {
      const { width, height, x, y } = previewBox.getBoundingClientRect();
      ipc.configurePreview(x, y, width, height);
    }

    // Surely something with invoke/handle to await the configurePreview
    // would be better here but I'm being lazy. We need to be sure the
    // backend has had a change to apply the settings before we reconfigure
    // the draggable boxes.
    setTimeout(() => {
      configureDraggableBoxes();
    }, 100);
  };

  const onSourceMove = (event: MouseEvent, src: WCRSceneItem) => {
    if (src === WCRSceneItem.OVERLAY) {
      setOverlayBoxDimensions((prev) => {
        const updated = {
          ...prev,
          x: prev.x + event.movementX,
          y: prev.y + event.movementY,
        };
        ipc.setSourcePosition(VideoSourceName.OVERLAY, updated);
        return updated;
      });
    } else {
      setGameBoxDimensions((prev) => {
        const updated = {
          ...prev,
          x: prev.x + event.movementX,
          y: prev.y + event.movementY,
        };
        ipc.setSourcePosition(VideoSourceName.WINDOW, updated);
        return updated;
      });
    }
  };

  const onSourceScale = (event: MouseEvent, src: WCRSceneItem) => {
    if (src === WCRSceneItem.OVERLAY) {
      setOverlayBoxDimensions((prev) => {
        const aspectRatio = prev.width / prev.height;
        let newWidth = prev.width + event.movementX;
        newWidth = Math.max(20, newWidth); // Prevent negative or too small sizes
        const newHeight = newWidth / aspectRatio;

        const updated = {
          ...prev,
          width: newWidth,
          height: newHeight,
        };

        ipc.setSourcePosition(VideoSourceName.WINDOW, updated);
        return updated;
      });
    } else {
      setGameBoxDimensions((prev) => {
        const aspectRatio = prev.width / prev.height;
        let newWidth = prev.width + event.movementX;
        newWidth = Math.max(20, newWidth); // Prevent negative or too small sizes
        const newHeight = newWidth / aspectRatio;

        const updated = {
          ...prev,
          width: newWidth,
          height: newHeight,
        };

        ipc.setSourcePosition(VideoSourceName.WINDOW, updated);
        return updated;
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

  const cleanupResizeObserver = () => {
    if (resizeObserver !== undefined) {
      resizeObserver.disconnect();
      resizeObserver = undefined;
    }
  };

  const setupResizeObserver = () => {
    if (resizeObserver === undefined) {
      resizeObserver = new ResizeObserver(() => configurePreview());
    }

    const previewBox = document.getElementById('preview-box');

    if (previewBox !== null) {
      resizeObserver.observe(previewBox);
    }
  };

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
      //console.log('Game window position:', left, top, width, height);
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
          outline: '2px solid #bb4420',
          outlineOffset: '-4px', // Slight offset to save it showing up on the edges.
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
            right: 2, // Slight offset to save it showing up on the edges.
            bottom: 2, // Slight offset to save it showing up on the edges.
            width: cornerSize,
            height: cornerSize,
            backgroundColor: '#bb4420',
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
