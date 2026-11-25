/**
 * Migrations for persisted configuration values.
 *
 * Each migration reads the values it cares about from the store, decides
 * whether anything needs to change, and writes back. Migrations
 * must be idempotent.
 */
import { AudioSource, AudioSourceType } from '../main/types';

/**
 * Typesafe mapping of the migratable keys.
 */
export interface MigratableStore {
  get(key: 'audioSources'): AudioSource[] | undefined;
  set(key: 'audioSources', value: AudioSource[]): void;
}

/**
 * Pre-Linux builds stored the literal OBS source type string
 * ("wasapi_output_capture", etc) as the AudioSourceType value. The
 * enum was changed to platform-neutral values (input/output/process)
 * with platform-specific mappings being done in noobs. This translates any legacy
 * entries to the new enum.
 */
const LEGACY_AUDIO_SOURCE_TYPES: Record<string, AudioSourceType> = {
  wasapi_output_capture: AudioSourceType.OUTPUT,
  wasapi_input_capture: AudioSourceType.INPUT,
  wasapi_process_output_capture: AudioSourceType.PROCESS,
};

/**
 * Translate any legacy AudioSourceType strings in audioSources to the
 * new enum values. Returns true if the store was written.
 */
export function migrateAudioSourceTypes(store: MigratableStore): boolean {
  const sources = store.get('audioSources');

  if (!sources || sources.length === 0) {
    return false;
  }

  let changed = false;
  const migrated = sources.map((s) => {
    const mapped = LEGACY_AUDIO_SOURCE_TYPES[s.type as unknown as string];
    if (mapped && s.type !== mapped) {
      changed = true;
      return { ...s, type: mapped };
    }
    return s;
  });

  if (!changed) {
    return false;
  }

  console.info(
    '[Config Service] Migrating legacy audioSources types to new enum',
  );
  store.set('audioSources', migrated);
  return true;
}

/**
 * Run all pending migrations against the given store.
 */
export function runMigrations(store: MigratableStore): void {
  migrateAudioSourceTypes(store);
}
