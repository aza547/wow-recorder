/**
 * Platform-neutral re-exports of recorder backend types.
 * Renderer and main-process callers import from here instead of a
 * specific native binding, so the active backend can be swapped by
 * platform without changes to consumers.
 */
export type {
  ObsData,
  ObsListItem,
  ObsProperty,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from 'noobs';
