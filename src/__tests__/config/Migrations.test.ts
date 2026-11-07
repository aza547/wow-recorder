import {
  MigratableStore,
  migrateAudioSourceTypes,
  runMigrations,
} from '../../config/migrations';
import { AudioSource, AudioSourceType } from '../../main/types';

const legacySource = (
  type: string,
  id: string,
  overrides: Partial<AudioSource> = {},
): AudioSource =>
  ({
    id,
    friendly: 'default',
    device: 'default',
    volume: 1,
    type: type as unknown as AudioSourceType,
    ...overrides,
  }) as AudioSource;

const makeStore = (initial: AudioSource[] | undefined) => {
  let current: AudioSource[] | undefined = initial;
  const sets: AudioSource[][] = [];
  const store: MigratableStore = {
    get: () => current,
    set: (_key, value) => {
      current = value;
      sets.push(value);
    },
  };
  return { store, sets };
};

test('undefined audioSources is treated as no-op', () => {
  const { store, sets } = makeStore(undefined);
  expect(migrateAudioSourceTypes(store)).toBe(false);
  expect(sets).toHaveLength(0);
});

test('empty audioSources is a no-op', () => {
  const { store, sets } = makeStore([]);
  expect(migrateAudioSourceTypes(store)).toBe(false);
  expect(sets).toHaveLength(0);
});

test('already-migrated entries do not trigger a write', () => {
  const sources: AudioSource[] = [
    {
      id: 'WCR Audio Source 1',
      friendly: 'default',
      device: 'default',
      volume: 1,
      type: AudioSourceType.OUTPUT,
    },
    {
      id: 'WCR Audio Source 2',
      friendly: 'default',
      device: 'default',
      volume: 1,
      type: AudioSourceType.INPUT,
    },
  ];

  const { store, sets } = makeStore(sources);
  expect(migrateAudioSourceTypes(store)).toBe(false);
  expect(sets).toHaveLength(0);
});

test('legacy wasapi_output_capture is mapped to OUTPUT', () => {
  const { store, sets } = makeStore([
    legacySource('wasapi_output_capture', 'WCR Audio Source 1'),
  ]);
  expect(migrateAudioSourceTypes(store)).toBe(true);
  expect(sets).toHaveLength(1);
  expect(sets[0][0].type).toBe(AudioSourceType.OUTPUT);
});

test('legacy wasapi_input_capture is mapped to INPUT', () => {
  const { store, sets } = makeStore([
    legacySource('wasapi_input_capture', 'WCR Audio Source 2'),
  ]);
  expect(migrateAudioSourceTypes(store)).toBe(true);
  expect(sets[0][0].type).toBe(AudioSourceType.INPUT);
});

test('legacy wasapi_process_output_capture is mapped to PROCESS', () => {
  const { store, sets } = makeStore([
    legacySource('wasapi_process_output_capture', 'WCR Audio Source 3'),
  ]);
  expect(migrateAudioSourceTypes(store)).toBe(true);
  expect(sets[0][0].type).toBe(AudioSourceType.PROCESS);
});

test('mixed array migrates legacy entries and preserves new ones', () => {
  const sources: AudioSource[] = [
    legacySource('wasapi_output_capture', 'WCR Audio Source 1'),
    {
      id: 'WCR Audio Source 2',
      friendly: 'default',
      device: 'default',
      volume: 1,
      type: AudioSourceType.INPUT,
    },
    legacySource('wasapi_process_output_capture', 'WCR Audio Source 3', {
      device: 'Wow.exe',
    }),
  ];

  const { store, sets } = makeStore(sources);
  expect(migrateAudioSourceTypes(store)).toBe(true);
  expect(sets[0].map((s) => s.type)).toEqual([
    AudioSourceType.OUTPUT,
    AudioSourceType.INPUT,
    AudioSourceType.PROCESS,
  ]);
  expect(sets[0][2].device).toBe('Wow.exe');
  expect(sets[0][0].id).toBe('WCR Audio Source 1');
});

test('non-type fields are preserved on migrated entries', () => {
  const { store, sets } = makeStore([
    legacySource('wasapi_output_capture', 'WCR Audio Source 1', {
      friendly: 'My Speakers',
      device: 'some-device-id',
      volume: 0.42,
    }),
  ]);

  expect(migrateAudioSourceTypes(store)).toBe(true);
  const [out] = sets[0];
  expect(out.type).toBe(AudioSourceType.OUTPUT);
  expect(out.friendly).toBe('My Speakers');
  expect(out.device).toBe('some-device-id');
  expect(out.volume).toBe(0.42);
});

test('unknown type strings pass through unchanged', () => {
  const { store, sets } = makeStore([
    legacySource('totally_unknown_type', 'WCR Audio Source X'),
  ]);
  expect(migrateAudioSourceTypes(store)).toBe(false);
  expect(sets).toHaveLength(0);
});

test('migration is idempotent across repeated invocations', () => {
  const { store, sets } = makeStore([
    legacySource('wasapi_output_capture', 'WCR Audio Source 1'),
    legacySource('wasapi_input_capture', 'WCR Audio Source 2'),
  ]);

  expect(migrateAudioSourceTypes(store)).toBe(true);
  expect(sets).toHaveLength(1);

  expect(migrateAudioSourceTypes(store)).toBe(false);
  expect(sets).toHaveLength(1);
});

test('runMigrations applies the audio source migration', () => {
  const { store, sets } = makeStore([
    legacySource('wasapi_output_capture', 'WCR Audio Source 1'),
  ]);

  runMigrations(store);
  expect(sets).toHaveLength(1);
  expect(sets[0][0].type).toBe(AudioSourceType.OUTPUT);
});
