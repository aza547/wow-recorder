import type { IRecorderBackend } from './platform/recorder/IRecorderBackend';

export interface EditorMouseEvent {
  // View-local px (relative to the preview NSView frame, top-left origin
  // CSS px on Mac since renderer sends already-scaled coords).
  offsetX: number;
  offsetY: number;
  button: number;
  // `buttons` is the BITMASK of currently-pressed buttons (1 = left).
  // On mouseMove this lets us detect a release that happened outside
  // the overlay div and abort an in-flight drag instead of
  // ghost-tracking the cursor.
  buttons: number;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

interface CanvasPoint {
  x: number;
  y: number;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

export type CommitListener = (info: {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
}) => void;

// Hit-radius (in canvas-px) for the libobs-drawn corner handles. Tuned
// to feel forgiving without stealing clicks too far from the corner.
const HANDLE_HIT_PX = 16;

/**
 * Mac scene-editor controller. Renderer captures mouse events on a
 * transparent overlay div and forwards `{offsetX, offsetY, button, modifiers}`.
 *
 * Behavior:
 *  - mouseDown on a corner of the currently-selected source → resize drag
 *    (aspect-locked, opposite corner anchored).
 *  - mouseDown elsewhere → top-down hit-test, select the topmost source
 *    under the cursor, start move drag.
 *  - mouseMove → update position or scale on the dragging item.
 *  - mouseUp → emit commit so Recorder persists to ConfigService.
 */
export default class EditorService {
  private static instance: EditorService;

  private backend: IRecorderBackend | undefined;

  private dragState:
    | {
        kind: 'move';
        name: string;
        startCanvas: CanvasPoint;
        startPos: { x: number; y: number };
      }
    | {
        kind: 'resize';
        name: string;
        corner: Corner;
        anchor: CanvasPoint;
        sourceWidth: number;
        sourceHeight: number;
      }
    | undefined;

  private selectedName: string | undefined;

  private commitListeners: CommitListener[] = [];

  static getInstance(): EditorService {
    if (!EditorService.instance) {
      EditorService.instance = new EditorService();
    }
    return EditorService.instance;
  }

  setBackend(backend: IRecorderBackend): void {
    this.backend = backend;
  }

  onCommit(cb: CommitListener): void {
    this.commitListeners.push(cb);
  }

  /**
   * Drop selection + drag state. Call this when libobs's display is
   * recreated (resolution change, scene rebuild) since the underlying
   * sceneitem.selected flag is cleared on the libobs side and our
   * cached selectedName is no longer authoritative.
   */
  reset(): void {
    this.dragState = undefined;
    this.selectedName = undefined;
    if (this.backend) {
      try {
        this.backend.clearSceneItemSelection();
      } catch {
        /* sceneitems may have been recreated; ignore */
      }
    }
  }

  viewToCanvas(vx: number, vy: number): CanvasPoint | null {
    if (!this.backend) return null;
    const info = this.backend.getPreviewInfo();
    if (!info.canvasWidth || !info.canvasHeight) return null;
    if (!info.previewWidth || !info.previewHeight) return null;

    const sfx = info.previewWidth / info.canvasWidth;
    const sfy = info.previewHeight / info.canvasHeight;
    const sf = Math.min(sfx, sfy);
    const xLimited = sfx < sfy;
    const xCorr = xLimited
      ? 0
      : (info.previewWidth - sfy * info.canvasWidth) / 2;
    const yCorr = xLimited
      ? (info.previewHeight - sfx * info.canvasHeight) / 2
      : 0;

    const canvasX = (vx - xCorr) / sf;
    const canvasY = (vy - yCorr) / sf;

    // Don't gate on canvas bounds — sources can be scaled larger than
    // the canvas and their corner handles can sit in the letterbox
    // bars. Items' own bbox tests reject clicks that don't hit them.
    return { x: canvasX, y: canvasY };
  }

  /**
   * Convert canvas-px to view-local px (inverse of viewToCanvas). Used
   * to size the resize-handle hit zones in view space-equivalent
   * canvas-px so the radius feels constant on screen regardless of zoom.
   */
  private viewPxToCanvasPx(viewPx: number): number {
    if (!this.backend) return viewPx;
    const info = this.backend.getPreviewInfo();
    if (!info.canvasWidth || !info.previewWidth) return viewPx;
    const sf = Math.min(
      info.previewWidth / info.canvasWidth,
      info.previewHeight / info.canvasHeight,
    );
    return sf > 0 ? viewPx / sf : viewPx;
  }

  /**
   * Returns the corner that `pt` falls within `HANDLE_HIT_PX` (view-px
   * equivalent) of, or undefined. Bbox derived from the source's current
   * canvas-space rectangle.
   */
  private hitCornerHandle(name: string, pt: CanvasPoint): Corner | undefined {
    if (!this.backend) return undefined;
    const pos = this.backend.getSourcePos(name);
    if (!pos.width || !pos.height) return undefined;
    const left = pos.x;
    const top = pos.y;
    const right = pos.x + pos.width * pos.scaleX;
    const bottom = pos.y + pos.height * pos.scaleY;
    const r = this.viewPxToCanvasPx(HANDLE_HIT_PX);
    const corners: Array<[Corner, number, number]> = [
      ['tl', left, top],
      ['tr', right, top],
      ['bl', left, bottom],
      ['br', right, bottom],
    ];
    for (const [c, cx, cy] of corners) {
      if (Math.abs(pt.x - cx) <= r && Math.abs(pt.y - cy) <= r) return c;
    }
    return undefined;
  }

  handleMouseDown(ev: EditorMouseEvent): void {
    if (!this.backend) return;
    const pt = this.viewToCanvas(ev.offsetX, ev.offsetY);
    if (!pt) {
      this.backend.clearSceneItemSelection();
      this.selectedName = undefined;
      return;
    }

    // First, check resize handles on the currently-selected item. Lets
    // users grab a corner that overlaps the next source's body (typical
    // when stacking the chat overlay over the game).
    if (this.selectedName) {
      const corner = this.hitCornerHandle(this.selectedName, pt);
      if (corner) {
        const pos = this.backend.getSourcePos(this.selectedName);
        const left = pos.x;
        const top = pos.y;
        const right = pos.x + pos.width * pos.scaleX;
        const bottom = pos.y + pos.height * pos.scaleY;
        const anchor: CanvasPoint = (() => {
          switch (corner) {
            case 'tl':
              return { x: right, y: bottom };
            case 'tr':
              return { x: left, y: bottom };
            case 'bl':
              return { x: right, y: top };
            case 'br':
            default:
              return { x: left, y: top };
          }
        })();
        this.dragState = {
          kind: 'resize',
          name: this.selectedName,
          corner,
          anchor,
          sourceWidth: pos.width,
          sourceHeight: pos.height,
        };
        return;
      }
    }

    // Top-down hit-test: scene.getItems() returns bottom-first, last is
    // topmost rendered → iterate from end.
    const items = this.backend.listSceneItems();
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const name = items[i];
      const pos = this.backend.getSourcePos(name);
      if (!pos.width || !pos.height) continue;

      const left = pos.x;
      const top = pos.y;
      const right = pos.x + pos.width * pos.scaleX;
      const bottom = pos.y + pos.height * pos.scaleY;
      if (pt.x < left || pt.x > right) continue;
      if (pt.y < top || pt.y > bottom) continue;

      this.backend.clearSceneItemSelection();
      this.backend.setSceneItemSelected(name, true);
      this.selectedName = name;
      this.dragState = {
        kind: 'move',
        name,
        startCanvas: pt,
        startPos: { x: pos.x, y: pos.y },
      };
      return;
    }

    this.backend.clearSceneItemSelection();
    this.selectedName = undefined;
  }

  handleMouseMove(ev: EditorMouseEvent): void {
    if (!this.backend || !this.dragState) return;
    // Cursor re-entered the overlay with no button pressed → mouseUp
    // happened outside the div. Treat as drag end + commit so the
    // user's last-known position/scale is persisted, then bail.
    if (ev.buttons === 0) {
      this.handleMouseUp(ev);
      return;
    }
    const pt = this.viewToCanvas(ev.offsetX, ev.offsetY);
    if (!pt) return;

    if (this.dragState.kind === 'move') {
      const dx = pt.x - this.dragState.startCanvas.x;
      const dy = pt.y - this.dragState.startCanvas.y;
      const current = this.backend.getSourcePos(this.dragState.name);
      this.backend.setSourcePos(this.dragState.name, {
        x: this.dragState.startPos.x + dx,
        y: this.dragState.startPos.y + dy,
        scaleX: current.scaleX,
        scaleY: current.scaleY,
        cropLeft: current.cropLeft,
        cropRight: current.cropRight,
        cropTop: current.cropTop,
        cropBottom: current.cropBottom,
      });
      return;
    }

    // resize: aspect-locked. Drag distance from anchor along x drives
    // the new scale; height auto-derived from sourceHeight * scale.
    const ds = this.dragState;
    const widthRaw = Math.abs(pt.x - ds.anchor.x);
    const minWidth = 20; // canvas-px floor; otherwise sources collapse to nothing
    const newWidth = Math.max(widthRaw, minWidth);
    const scale = newWidth / ds.sourceWidth;
    const newHeight = ds.sourceHeight * scale;

    // Position so the anchor stays pinned. The dragged corner is
    // diagonally opposite; use anchor + per-corner sign.
    let newX: number;
    let newY: number;
    switch (ds.corner) {
      case 'tl':
        newX = ds.anchor.x - newWidth;
        newY = ds.anchor.y - newHeight;
        break;
      case 'tr':
        newX = ds.anchor.x;
        newY = ds.anchor.y - newHeight;
        break;
      case 'bl':
        newX = ds.anchor.x - newWidth;
        newY = ds.anchor.y;
        break;
      case 'br':
      default:
        newX = ds.anchor.x;
        newY = ds.anchor.y;
        break;
    }

    const current = this.backend.getSourcePos(ds.name);
    this.backend.setSourcePos(ds.name, {
      x: newX,
      y: newY,
      scaleX: scale,
      scaleY: scale,
      cropLeft: current.cropLeft,
      cropRight: current.cropRight,
      cropTop: current.cropTop,
      cropBottom: current.cropBottom,
    });
  }

  handleMouseUp(_ev: EditorMouseEvent): void {
    if (!this.backend || !this.dragState) {
      this.dragState = undefined;
      return;
    }
    const name = this.dragState.name;
    this.dragState = undefined;
    const pos = this.backend.getSourcePos(name);
    this.commitListeners.forEach((cb) =>
      cb({
        name,
        x: pos.x,
        y: pos.y,
        width: pos.width * pos.scaleX,
        height: pos.height * pos.scaleY,
        cropLeft: pos.cropLeft,
        cropRight: pos.cropRight,
        cropTop: pos.cropTop,
        cropBottom: pos.cropBottom,
      }),
    );
  }
}
