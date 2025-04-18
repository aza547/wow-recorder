import React from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './DrawingOverlay.css';

interface DrawingOverlayProps {
  isDrawingEnabled: boolean;
  onDrawingChange: (elements: readonly any[]) => void;
  width: number;
  height: number;
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  isDrawingEnabled,
  onDrawingChange,
  width,
  height,
}) => {
  if (!isDrawingEnabled) return null;
  return (
    <div className="drawing-overlay" style={{ width, height }}>
      <div className="drawing-overlay-content">
        <Excalidraw
          theme="dark"
          gridModeEnabled={false}
          viewModeEnabled={false}
          zenModeEnabled={false}
          name="Drawing Overlay"
          onChange={(elements) => onDrawingChange(elements)}
          initialData={{
            appState: {
              viewBackgroundColor: 'transparent',
              activeTool: {
                type: 'freedraw',
                lastActiveTool: null,
                locked: true,
                customType: null,
              },
            },
          }}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              saveAsImage: false,
            },
            tools: {
              image: false,
            },
          }}
        ></Excalidraw>
      </div>
    </div>
  );
};
