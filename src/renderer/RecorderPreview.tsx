import { Box } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { stopPropagation } from './rendererutils';
import { BoxDimensions, SceneInteraction, SceneItem } from 'main/types';
import { ConfigurationSchema } from 'config/configSchema';

const ipc = window.electron.ipcRenderer;
const showPreview = ipc.showPreview;
const hidePreview = ipc.hidePreview;
const disablePreview = ipc.disablePreview;
const cornerSize = 25; // Size in pixels for the corner box
const snapDistance = 15; // Number of pixels to snap to.

enum Snap {
  TOP = 'Top',
  BOTTOM = 'Bottom',
  LEFT = 'Left',
  RIGHT = 'Right',
  NONE = 'None',
}

const RecorderPreview = (props: {
  previewEnabled: boolean;
  config: ConfigurationSchema;
  snapEnabled: boolean;
}) => {
  const { previewEnabled, config, snapEnabled } = props;

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

  const snapOverlay = { x: Snap.NONE, y: Snap.NONE };
  const snapGame = { x: Snap.NONE, y: Snap.NONE };

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

    configurePreview();
    showPreview();
    setupResizeObserver();

    return () => {
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

  useEffect(() => {
    configureDraggableBoxes();
  }, [snapEnabled, config.chatOverlayEnabled]);

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

  if (snapEnabled) {
    // Decide if we should snap the chat overlay.
    if (Math.abs(overlayBoxDimensions.y) < snapDistance) {
      snapOverlay.y = Snap.TOP;
    } else if (
      Math.abs(
        overlayBoxDimensions.y +
          overlayBoxDimensions.height -
          previewInfo.previewHeight +
          2 * yCorr,
      ) < snapDistance
    ) {
      snapOverlay.y = Snap.BOTTOM;
    }

    if (Math.abs(overlayBoxDimensions.x) < snapDistance) {
      snapOverlay.x = Snap.LEFT;
    } else if (
      Math.abs(
        overlayBoxDimensions.x +
          overlayBoxDimensions.width -
          previewInfo.previewWidth +
          2 * xCorr,
      ) < snapDistance
    ) {
      snapOverlay.x = Snap.RIGHT;
    }

    // Decide if we should snap the game overlay.
    if (Math.abs(gameBoxDimensions.y) < snapDistance) {
      snapGame.y = Snap.TOP;
    } else if (
      Math.abs(
        gameBoxDimensions.y +
          gameBoxDimensions.height -
          previewInfo.previewHeight +
          2 * yCorr,
      ) < snapDistance
    ) {
      snapGame.y = Snap.BOTTOM;
    }

    if (Math.abs(gameBoxDimensions.x) < snapDistance) {
      snapGame.x = Snap.LEFT;
    } else if (
      Math.abs(
        gameBoxDimensions.x +
          gameBoxDimensions.width -
          previewInfo.previewWidth +
          2 * xCorr,
      ) < snapDistance
    ) {
      snapGame.x = Snap.RIGHT;
    }
  }

  const configureDraggableBoxes = async () => {
    const display = await ipc.getDisplayInfo();
    setPreviewInfo(display);

    if (config.chatOverlayEnabled) {
      const chat = await ipc.getSourcePosition(SceneItem.OVERLAY);
      setOverlayBoxDimensions(chat);
    }

    const game = await ipc.getSourcePosition(SceneItem.GAME);
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

  const onSourceMove = (event: MouseEvent, src: SceneItem) => {
    if (src === SceneItem.OVERLAY) {
      setOverlayBoxDimensions((prev) => {
        const updated = {
          ...prev,
          x: prev.x + event.movementX,
          y: prev.y + event.movementY,
        };

        const snapped = { ...updated };

        if (snapOverlay.x === Snap.LEFT) {
          snapped.x = 0;
        } else if (snapOverlay.x === Snap.RIGHT) {
          snapped.x = previewInfo.previewWidth - snapped.width - 2 * xCorr;
        }

        if (snapOverlay.y === Snap.TOP) {
          snapped.y = 0;
        } else if (snapOverlay.y === Snap.BOTTOM) {
          snapped.y = previewInfo.previewHeight - snapped.height - 2 * yCorr;
        }

        ipc.setSourcePosition(SceneItem.OVERLAY, snapped);
        return updated;
      });
    } else {
      setGameBoxDimensions((prev) => {
        const updated = {
          ...prev,
          x: prev.x + event.movementX,
          y: prev.y + event.movementY,
        };

        const snapped = { ...updated };

        if (snapGame.x === Snap.LEFT) {
          snapped.x = 0;
        } else if (snapGame.x === Snap.RIGHT) {
          snapped.x = previewInfo.previewWidth - snapped.width - 2 * xCorr;
        }

        if (snapGame.y === Snap.TOP) {
          snapped.y = 0;
        } else if (snapGame.y === Snap.BOTTOM) {
          snapped.y = previewInfo.previewHeight - snapped.height - 2 * yCorr;
        }

        ipc.setSourcePosition(SceneItem.GAME, snapped);
        return updated;
      });
    }
  };

  const onSourceScale = (event: MouseEvent, src: SceneItem) => {
    if (src === SceneItem.OVERLAY) {
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

        ipc.setSourcePosition(SceneItem.OVERLAY, updated);
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

        ipc.setSourcePosition(SceneItem.GAME, updated);
        return updated;
      });
    }
  };

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (draggingOverlay.current === SceneInteraction.MOVE) {
        onSourceMove(event, SceneItem.OVERLAY);
      } else if (draggingGame.current === SceneInteraction.MOVE) {
        onSourceMove(event, SceneItem.GAME);
      } else if (draggingGame.current === SceneInteraction.SCALE) {
        onSourceScale(event, SceneItem.GAME);
      } else if (draggingOverlay.current === SceneInteraction.SCALE) {
        onSourceScale(event, SceneItem.OVERLAY);
      }
    },
    [onSourceMove],
  );

  const onMouseUp = () => {
    draggingGame.current = SceneInteraction.NONE;
    draggingOverlay.current = SceneInteraction.NONE;
  };

  const onMouseDown = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement>,
      src: SceneItem,
      action: SceneInteraction,
    ) => {
      if (src === SceneItem.OVERLAY) {
        draggingOverlay.current = action;
      } else {
        draggingGame.current = action;
      }

      stopPropagation(event);
    },
    [],
  );

  useEffect(() => {
    // Listen on the document for mouse events other than mousedown,
    // so that if the cursor goes outwith the draggable area, we can
    // still capture the events.
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      // Remove the mouse event listeners.
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

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

  const renderDraggableSceneBox = (src: SceneItem) => {
    if (src === SceneItem.OVERLAY && !config.chatOverlayEnabled) {
      return <></>;
    }

    const { x, y, width, height } =
      src === SceneItem.OVERLAY ? overlayBoxDimensions : gameBoxDimensions;

    const snap = src === SceneItem.OVERLAY ? snapOverlay : snapGame;

    if (width < 1 && height < 1) {
      return <></>;
    }

    const text = src === SceneItem.OVERLAY ? 'Chat Overlay' : 'Game Window';

    const position: {
      left?: number;
      right?: number;
      top?: number;
      bottom?: number;
    } = {
      left: undefined,
      right: undefined,
      top: undefined,
      bottom: undefined,
    };

    if (snap.x === Snap.LEFT) {
      position.left = xCorr;
    } else if (snap.x === Snap.RIGHT) {
      position.left = previewInfo.previewWidth - width - xCorr;
    } else {
      position.left = x + xCorr;
    }

    if (snap.y === Snap.TOP) {
      position.top = yCorr;
    } else if (snap.y === Snap.BOTTOM) {
      position.top = previewInfo.previewHeight - height - yCorr;
    } else {
      position.top = y + yCorr;
    }

    return (
      <Box
        id={src === SceneItem.OVERLAY ? 'overlay-box' : 'game-box'}
        onMouseDown={(e) => onMouseDown(e, src, SceneInteraction.MOVE)}
        sx={{
          position: 'absolute',
          ...position,
          height,
          width,
          outline: '2px solid #bb4420',
          outlineOffset: '-4px', // Slight offset to save it showing up on the edges.
          zIndex: ++zIndex,
          cursor: 'move',
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
            cursor: 'se-resize',
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
        {renderDraggableSceneBox(SceneItem.GAME)}
        {renderDraggableSceneBox(SceneItem.OVERLAY)}
      </div>
    </div>
  );
};

export default RecorderPreview;
