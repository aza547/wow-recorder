import { useQuery } from '@tanstack/react-query';
import type { RecorderCapabilities } from 'main/platform/recorder/IRecorderBackend';
import { CaptureModeCapability } from 'main/platform/recorder/IRecorderBackend';
import { ESupportedEncoders } from 'main/obsEnums';

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
