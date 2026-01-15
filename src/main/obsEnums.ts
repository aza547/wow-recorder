export const enum ERecordingState {
  None = 'none',
  Recording = 'recording',
}

export const enum EOBSOutputSignal {
  Starting = 'starting',
  Start = 'start',
  Stopping = 'stopping',
  Stop = 'stop',
  Activate = 'activate',
  Deactivate = 'deactivate',
}

export enum ESupportedEncoders {
  OBS_X264 = 'obs_x264',
  AMD_H264 = 'h264_texture_amf',
  AMD_AV1 = 'av1_texture_amf',
  NVENC_H264 = 'obs_nvenc_h264_tex',
  NVENC_AV1 = 'obs_nvenc_av1_tex',
  QSV_H264 = 'obs_qsv11_soft_v2',
  QSV_AV1 = 'obs_qsv11_av1',
}

export enum QualityPresets {
  ULTRA = 'Ultra',
  HIGH = 'High',
  MODERATE = 'Moderate',
  LOW = 'Low',
}

export const enum CaptureMode {
  WINDOW,
  GAME,
  MONITOR,
  // TODO: [linux-port] Linux only
  PIPEWIRE,
  // TODO: [linux-port] END
  NONE,
}
