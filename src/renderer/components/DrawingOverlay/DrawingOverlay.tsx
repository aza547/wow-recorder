import React, { useEffect, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './DrawingOverlay.css';
import { AppState } from 'main/types';
import { Language } from 'localisation/phrases';
import { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/dist/types/excalidraw/types';

interface DrawingOverlayProps {
  // 'edit' is an interactive freedraw canvas; 'view' is a read-only display of
  // the current keyframe, used for "flash" playback.
  mode: 'edit' | 'view';
  // The scene to show right now (the active keyframe's elements, or [] none).
  elements: readonly ExcalidrawElement[];
  // A token that changes only when the canvas should be re-seeded (a keyframe
  // flip in view mode, or an edit-time change in edit mode). User edits do NOT
  // change it, so an in-progress drawing is never clobbered by a re-seed.
  sceneKey: string;
  // Fired in edit mode when the user mutates the scene.
  onDrawingChange: (elements: readonly ExcalidrawElement[]) => void;
  appState: AppState;
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  mode,
  elements,
  sceneKey,
  onDrawingChange,
  appState,
}) => {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const viewMode = mode === 'view';

  // True once the user has put a pointer down on the canvas since the last
  // programmatic re-seed. Excalidraw fires onChange both for real edits AND as
  // an echo of our own updateScene() calls; without this gate those echoes get
  // mis-persisted (re-stamping seeded content at the wrong time -> moved /
  // merged / deleted keyframes). Only a change the user actually drew counts.
  const editedSinceSeedRef = useRef(false);

  // Convert current language to a language code supported by Excalidraw
  const langCodeMap = {
    [Language.ENGLISH]: 'en',
    [Language.KOREAN]: 'ko-KR',
    [Language.GERMAN]: 'de-DE',
    [Language.CHINESE_SIMPLIFIED]: 'zh-CN',
  };

  const langCode = langCodeMap[appState.language];

  // Re-seed the live canvas whenever sceneKey changes (a keyframe flip or an
  // edit-time change), without remounting Excalidraw. We depend on sceneKey
  // rather than `elements` so the user's own in-progress edits don't trigger a
  // re-seed that would wipe them.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.updateScene({ elements: [...elements] });
    // This scene came from us, not the user. Ignore the resulting onChange
    // echo(es) until the user next interacts.
    editedSinceSeedRef.current = false;
  }, [sceneKey]);

  return (
    <div
      className={`drawing-overlay h-full w-full${viewMode ? ' view-mode' : ''}`}
      onKeyDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="drawing-overlay-content"
        // In view mode the overlay must not intercept clicks so the video and
        // its controls stay usable while annotations are shown.
        style={{ pointerEvents: viewMode ? 'none' : 'auto' }}
        // Capture phase so we record the interaction before Excalidraw handles
        // it. Marks subsequent onChange events as genuine user edits.
        onPointerDownCapture={() => {
          if (!viewMode) editedSinceSeedRef.current = true;
        }}
      >
        <Excalidraw
          theme="dark"
          gridModeEnabled={false}
          viewModeEnabled={viewMode}
          zenModeEnabled={false}
          name="Drawing Overlay"
          key={langCode} // Re-render when language changes
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          onChange={(els) => {
            if (viewMode) return;
            if (!editedSinceSeedRef.current) return;
            onDrawingChange(els);
          }}
          langCode={langCode}
          initialData={{
            elements: [...elements],
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
