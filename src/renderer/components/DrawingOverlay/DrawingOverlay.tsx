import React, { useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './DrawingOverlay.css';
import { AppState } from 'main/types';
import { Language } from 'localisation/phrases';
import { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import {
  ExcalidrawImperativeAPI,
  NormalizedZoomValue,
} from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import { AnnotationRef } from '../../annotations';

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
  // The capture resolution element coords are expressed in. When set, the canvas
  // is sized to the letterboxed video rect and zoomed so this reference space
  // maps onto it — making annotations resolution-independent. Null for legacy
  // records (or before metadata loads): falls back to 1:1 pixel behaviour.
  refResolution: AnnotationRef | null;
  // Fired in edit mode when the user mutates the scene.
  onDrawingChange: (elements: readonly ExcalidrawElement[]) => void;
  appState: AppState;
}

type Rect = { left: number; top: number; width: number; height: number };

/**
 * The video-content rectangle within `box`, given the reference aspect ratio.
 * The `<video>` letterboxes (preserves aspect) inside its cell, so annotations
 * must map to this inner rect, not the whole cell. With no ref (legacy / pre-
 * metadata) the rect is the full box and the caller uses zoom 1.
 */
const computeContentRect = (
  box: { w: number; h: number },
  ref: AnnotationRef | null,
): Rect => {
  if (!ref || ref.w <= 0 || ref.h <= 0 || box.w <= 0 || box.h <= 0) {
    return { left: 0, top: 0, width: box.w, height: box.h };
  }

  const aspect = ref.w / ref.h;
  const boxAspect = box.w / box.h;

  let width: number;
  let height: number;

  if (boxAspect > aspect) {
    // Box is wider than the video → pillarbox (bars on the left/right).
    height = box.h;
    width = box.h * aspect;
  } else {
    // Box is taller than the video → letterbox (bars on top/bottom).
    width = box.w;
    height = box.w / aspect;
  }

  return {
    left: (box.w - width) / 2,
    top: (box.h - height) / 2,
    width,
    height,
  };
};

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  mode,
  elements,
  sceneKey,
  refResolution,
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

  // Live pixel size of the overlay cell, tracked so the canvas follows window /
  // frame resizes. Drives the letterboxed content rect and the Excalidraw zoom.
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setBox({ w: cr.width, h: cr.height });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rect = computeContentRect(box, refResolution);

  // Map the reference space onto the content rect: a scene unit of `ref.w`
  // spans `rect.width` px, so zoom = rect.width / ref.w (scroll stays 0). With
  // no ref we keep zoom 1 (legacy 1:1 pixel behaviour). Excalidraw clamps zoom
  // to [0.1, 30]; the floor only bites at an extreme downscale, which is fine.
  const targetZoom = (
    refResolution && refResolution.w > 0 && rect.width > 0
      ? rect.width / refResolution.w
      : 1
  ) as NormalizedZoomValue;

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

  // Keep the viewport locked to the reference space as the cell resizes. Only
  // the appState transform is touched (not elements), so an in-progress stroke
  // is never wiped; and since elements are unchanged, the onChange echo is a
  // no-op for persistence even if it slips past editedSinceSeedRef.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.updateScene({
      appState: { zoom: { value: targetZoom }, scrollX: 0, scrollY: 0 },
    });
  }, [targetZoom]);

  return (
    <div
      ref={containerRef}
      className={`drawing-overlay h-full w-full${viewMode ? ' view-mode' : ''}`}
      style={{ position: 'relative' }}
      onKeyDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="drawing-overlay-content"
        // Positioned/sized to the letterboxed video-content rect so annotations
        // land on the video pixels, not the cell's letterbox bars.
        style={{
          position: 'absolute',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          // In view mode the overlay must not intercept clicks so the video and
          // its controls stay usable while annotations are shown.
          pointerEvents: viewMode ? 'none' : 'auto',
        }}
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
              zoom: { value: targetZoom },
              scrollX: 0,
              scrollY: 0,
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
