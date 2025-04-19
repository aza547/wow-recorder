import React from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './DrawingOverlay.css';
import { AppState } from 'main/types';
import { Language } from 'localisation/types';

interface DrawingOverlayProps {
  isDrawingEnabled: boolean;
  onDrawingChange: (elements: readonly any[]) => void;
  appState: AppState;
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  isDrawingEnabled,
  onDrawingChange,
  appState,
}) => {
  if (!isDrawingEnabled) return null;

  // Convert current language to a language code supported by Excalidraw
  let langCode = 'en';
  if (appState.language === Language.KOREAN) {
    langCode = 'ko-KR';
  } else if (appState.language === Language.GERMAN) {
    langCode = 'de-DE';
  } else if (appState.language === Language.CHINESE_SIMPLIFIED) {
    langCode = 'zh-CN';
  }

  return (
    <div className="drawing-overlay-content">
      <Excalidraw
        key={langCode} // Add key to re-render component when language changes
        onChange={(elements) => onDrawingChange(elements)}
        langCode={langCode}
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
      />
    </div>
  );
};
