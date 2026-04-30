declare module 'node-window-rendering' {
  /** Create a Cocoa child NSWindow over `parentNSView` (Buffer). */
  export function createWindow(
    name: string,
    parentNSView: Buffer,
    renderAtBottom?: boolean,
  ): void;
  /** Destroy the previously created child window. */
  export function destroyWindow(name: string): void;
  /** Connect an IOSurface (id from OBS_content_createIOSurface) for drawing. */
  export function connectIOSurface(name: string, surfaceId: number): void;
  /** Detach + free the IOSurface. */
  export function destroyIOSurface(name: string): void;
  /** Move the child window to (x, y) in screen-relative point coordinates. */
  export function moveWindow(name: string, x: number, y: number): void;
}
