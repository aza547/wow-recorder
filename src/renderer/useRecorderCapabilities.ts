import { useQuery } from '@tanstack/react-query';
import type { RecorderCapabilities } from 'main/platform/recorder/IRecorderBackend';
import { CaptureModeCapability } from 'main/platform/recorder/IRecorderBackend';
import { ESupportedEncoders } from 'main/obsEnums';

// Superset of all encoders we may surface across platforms — the
// real backend filters down to its supported set. Used as the initial
// data while the IPC resolves so the dropdown isn't briefly missing
// options on Mac (Apple VideoToolbox encoders) before the real caps
// arrive.
const FALLBACK: RecorderCapabilities = {
  captureModes: [
    CaptureModeCapability.GAME,
    CaptureModeCapability.WINDOW,
    CaptureModeCapability.MONITOR,
  ],
  encoders: [
    ESupportedEncoders.OBS_X264,
    ESupportedEncoders.AMD_H264,
    ESupportedEncoders.AMD_AV1,
    ESupportedEncoders.NVENC_H264,
    ESupportedEncoders.NVENC_AV1,
    ESupportedEncoders.QSV_H264,
    ESupportedEncoders.QSV_AV1,
    ESupportedEncoders.VT_H264,
    ESupportedEncoders.VT_HEVC,
  ],
  supportsReplayBuffer: true,
};

/**
 * Read recorder-backend capabilities once — they are constant for a
 * given platform + app version, so staleTime is effectively infinite.
 * Returns FALLBACK (full Windows feature set) until the IPC resolves.
 */
export function useRecorderCapabilities(): RecorderCapabilities {
  const { data } = useQuery<RecorderCapabilities>({
    queryKey: ['recorder-capabilities'],
    queryFn: () => window.recorderCapabilities.get(),
    staleTime: Infinity,
    initialData: FALLBACK,
  });
  return data;
}
