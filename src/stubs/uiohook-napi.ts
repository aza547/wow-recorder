import { EventEmitter } from 'events';

export type UiohookKeyboardEvent = {
  type: number;
  keycode: number;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

export type UiohookMouseEvent = {
  type: number;
  button: number;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

export enum EventType {
  EVENT_KEY_PRESSED = 4,
  EVENT_KEY_RELEASED = 5,
  EVENT_MOUSE_PRESSED = 6,
  EVENT_MOUSE_RELEASED = 7,
}

class UiohookStub extends EventEmitter {
  public start() {}
  public stop() {}
}

// Match the real module's export name.
export const uIOhook = new UiohookStub();

