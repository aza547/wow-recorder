import React from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './DrawingOverlay.css';
import { AppState } from 'main/types';
import { Language } from 'localisation/phrases';
import { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';

interface DrawingOverlayProps {
  isDrawingEnabled: boolean;
  onDrawingChange: (elements: readonly ExcalidrawElement[]) => void;
  appState: AppState;
  initialElements?: readonly ExcalidrawElement[];
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  isDrawingEnabled,
  onDrawingChange,
  appState,
  initialElements = [],
}) => {
  if (!isDrawingEnabled) return null;

  // Convert current language to a language code supported by Excalidraw
  const langCodeMap = {
    [Language.ENGLISH]: 'en',
    [Language.KOREAN]: 'ko-KR',
    [Language.GERMAN]: 'de-DE',
    [Language.CHINESE_SIMPLIFIED]: 'zh-CN',
  };

  const langCode = langCodeMap[appState.language];

  return (
    <div
      className="drawing-overlay h-full w-full"
      onKeyDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="drawing-overlay-content">
        <Excalidraw
          theme="dark"
          gridModeEnabled={false}
          viewModeEnabled={false}
          zenModeEnabled={false}
          name="Drawing Overlay"
          key={langCode} // Add key to re-render component when language changes
          onChange={(elements) => onDrawingChange(elements)}
          langCode={langCode}
          initialData={{
            elements: initialElements,
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
        />
      </div>
    </div>
  );
};
