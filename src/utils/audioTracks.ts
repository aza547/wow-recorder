import type { AudioSource } from 'main/types';

const OBS_AUDIO_TRACKS = [1, 2, 3, 4, 5, 6] as const;
type AudioTrackNumber = (typeof OBS_AUDIO_TRACKS)[number];

const MIXED_AUDIO_TRACK = 1;
const MIXED_AUDIO_TRACK_MASK = 1;
const ISOLATED_AUDIO_TRACKS = OBS_AUDIO_TRACKS.slice(1);

const normalizeAudioTracks = (tracks: unknown): AudioTrackNumber[] => {
  if (!Array.isArray(tracks)) return [];

  const normalized = tracks.filter(
    (track): track is AudioTrackNumber =>
      Number.isInteger(track) &&
      OBS_AUDIO_TRACKS.includes(track as AudioTrackNumber),
  );

  return [...new Set(normalized)].sort((a, b) => a - b);
};

const getDefaultAudioTracks = (sourceIndex: number): AudioTrackNumber[] => {
  const isolatedTrack = ISOLATED_AUDIO_TRACKS[sourceIndex];
  return isolatedTrack
    ? [MIXED_AUDIO_TRACK, isolatedTrack]
    : [MIXED_AUDIO_TRACK];
};

const normalizeAudioSourceTracks = (sources: AudioSource[]): AudioSource[] => {
  return sources.map((source, index) => {
    const audioTracks = normalizeAudioTracks(source.audioTracks);

    return {
      ...source,
      audioTracks:
        audioTracks.length > 0 ? audioTracks : getDefaultAudioTracks(index),
    };
  });
};

const getAudioTracksForNewSource = (
  sources: AudioSource[],
): AudioTrackNumber[] => {
  const usedTracks = new Set(
    normalizeAudioSourceTracks(sources)
      .flatMap((source) => source.audioTracks ?? [])
      .filter((track) => track !== MIXED_AUDIO_TRACK),
  );

  const isolatedTrack = ISOLATED_AUDIO_TRACKS.find(
    (track) => !usedTracks.has(track),
  );

  return isolatedTrack
    ? [MIXED_AUDIO_TRACK, isolatedTrack]
    : [MIXED_AUDIO_TRACK];
};

const getAudioTrackMask = (
  tracks: unknown,
  separateAudioTracks: boolean,
): number => {
  if (!separateAudioTracks) return MIXED_AUDIO_TRACK_MASK;

  const audioTracks = normalizeAudioTracks(tracks);

  // Sources with no track assignment should be removed instead of muted.
  if (audioTracks.length === 0) return MIXED_AUDIO_TRACK_MASK;

  // OBS represents tracks 1-6 as bits 0-5 in a mixer mask.
  return audioTracks.reduce((mask, track) => mask | (1 << (track - 1)), 0);
};

export {
  AudioTrackNumber,
  OBS_AUDIO_TRACKS,
  getAudioTrackMask,
  getAudioTracksForNewSource,
  normalizeAudioSourceTracks,
  normalizeAudioTracks,
};
