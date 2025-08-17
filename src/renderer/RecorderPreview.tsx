import { Box } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { stopPropagation } from './rendererutils';
import { BoxDimensions, SceneInteraction, WCRSceneItem } from 'main/types';
import { ConfigurationSchema } from 'config/configSchema';

const ipc = window.electron.ipcRenderer;
const showPreview = ipc.showPreview;
const hidePreview = ipc.hidePreview;
const disablePreview = ipc.disablePreview;
const cornerSize = 25; // Size in pixels for the corner box

const RecorderPreview = (props: {
  previewEnabled: boolean;
  config: ConfigurationSchema;
}) => {
  const { previewEnabled, config } = props;

  const initialRender = useRef(true);
  const previewDivRef = useRef<HTMLDivElement>(null);
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

      // Disable the preview, we're tabbing away. This means it's switched
      // off and not consuming GPU resources rather than just hidden from view.
      disablePreview();
    };
  }, []);

  useEffect(() => {
    if (initialRender.current) {
      // Just save calling the stuff below on initial render, we setup
      // everything in the other use effect. This isn't really important
      // but it helps to avoid unnecessary function calls.
      initialRender.current = false;
      return;
    }

    if (previewEnabled) {
      showPreview();
    } else {
      hidePreview();
    }
  }, [previewEnabled]);

  // The display maintains the canvas ratio, so it is either X limited,
  // Y limited, or a perfect fit. We need to calculate that to offset the
  // draggable boxes on the preview box, and also to account for snapping.
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

  const configureDraggableBoxes = async () => {
    const display = await ipc.getDisplayInfo();
    setPreviewInfo(display);
    console.log(display);

    if (config.chatOverlayEnabled) {
      const chat = await ipc.getSourcePosition(WCRSceneItem.OVERLAY);
      setOverlayBoxDimensions(chat);
    }

    const game = await ipc.getSourcePosition(WCRSceneItem.GAME);
    setGameBoxDimensions(game);
  };

  const configurePreview = async () => {
    if (previewDivRef.current) {
      const { width, height, x, y } =
        previewDivRef.current.getBoundingClientRect();
      ipc.configurePreview(x, y, width, height);
    }
  };

  useEffect(() => {
    ipc.on('redrawPreview', configureDraggableBoxes);

    return () => {
      ipc.removeAllListeners('redrawPreview');
    };
  }, [configureDraggableBoxes]);

  const onSourceMove = (event: MouseEvent, src: WCRSceneItem) => {
    if (src === WCRSceneItem.OVERLAY) {
      setOverlayBoxDimensions((prev) => {
        const updated = {
          ...prev,
          x: prev.x + event.movementX,
          y: prev.y + event.movementY,
        };

        ipc.setSourcePosition(WCRSceneItem.OVERLAY, updated);
        return updated;
      });
    } else {
      setGameBoxDimensions((prev) => {
        const updated = {
          ...prev,
          x: prev.x + event.movementX,
          y: prev.y + event.movementY,
        };
        ipc.setSourcePosition(WCRSceneItem.GAME, updated);
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

        ipc.setSourcePosition(WCRSceneItem.OVERLAY, updated);
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

        ipc.setSourcePosition(WCRSceneItem.GAME, updated);
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
    draggingGame.current = SceneInteraction.NONE;
    draggingOverlay.current = SceneInteraction.NONE;
  };

  const onMouseDown = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement>,
      src: WCRSceneItem,
      action: SceneInteraction,
    ) => {
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

    if (previewDivRef.current) {
      resizeObserver.observe(previewDivRef.current);
    }
  };

  const renderDraggableSceneBox = (src: WCRSceneItem) => {
    if (src === WCRSceneItem.OVERLAY && !config.chatOverlayEnabled) {
      return <></>;
    }

    const { x, y, width, height } =
      src === WCRSceneItem.OVERLAY ? overlayBoxDimensions : gameBoxDimensions;

    if (width < 1 && height < 1) {
      return <></>;
    }

    const text = src === WCRSceneItem.OVERLAY ? 'Chat Overlay' : 'Game Window';

    const left = x + xCorr;
    const top = y + yCorr;

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
    <div className="w-full h-full box-border bg-black">
      <div
        ref={previewDivRef}
        className="relative h-full mx-12 overflow-hidden border border-black"
      >
        {renderDraggableSceneBox(WCRSceneItem.GAME)}
        {renderDraggableSceneBox(WCRSceneItem.OVERLAY)}
      </div>
    </div>
  );
};

export default RecorderPreview;
