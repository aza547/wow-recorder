# Settings Reference
This is intended to be a quick reference to help understand the configuration we can apply to libobs via the obs-studio-node package. It's been collated using the following functions:
  - OBS_settings_getListCategories
  - OBS_settings_getSettings
## Categories
```
[
  'General',  
  'Stream',
  'Output',   
  'Audio',
  'Video',    
  'Hotkeys',
  'Advanced'
]
```

## General
```
{
  data: [
    {
      nameSubCategory: 'Output',
      parameters: [
        {
          name: 'WarnBeforeStartingStream',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Show confirmation dialog when starting streams',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'WarnBeforeStoppingStream',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Show confirmation dialog when stopping streams',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'RecordWhenStreaming',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Automatically record when streaming',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'KeepRecordingWhenStreamStops',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Keep recording when stream stops',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'ReplayBufferWhileStreaming',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Automatically start replay buffer when streaming',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'KeepReplayBufferStreamStops',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Keep replay buffer active when stream stops',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Source Alignement Snapping',
      parameters: [
        {
          name: 'SnappingEnabled',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Enable',
          subType: '',
          currentValue: true,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'SnapDistance',
          type: 'OBS_PROPERTY_DOUBLE',
          description: 'Snap Sensitivity',
          subType: '',
          currentValue: 10,
          minVal: 0,
          maxVal: 100,
          stepVal: 0.5,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'ScreenSnapping',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Snap Sources to edge of screen',
          subType: '',
          currentValue: true,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'SourceSnapping',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Snap Sources to other sources',
          subType: '',
          currentValue: true,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'CenterSnapping',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Snap Sources to horizontal and vertical center',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Projectors',
      parameters: [
        {
          name: 'HideProjectorCursor',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Hide cursor over projectors',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'ProjectorAlwaysOnTop',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Make projectors always on top',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'SaveProjectors',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Save projectors on exit',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'System Tray',
      parameters: [
        {
          name: 'SysTrayEnabled',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Enable',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'SysTrayWhenStarted',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Minimize to system tray when started',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'SysTrayMinimizeToTray',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Always minimize to system tray instead of task bar',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    }
  ],
  type: 0
}
```

## Video
```
{
  data: [
    {
      nameSubCategory: 'Untitled',
      parameters: [
        {
          name: 'Base',
          type: 'OBS_INPUT_RESOLUTION_LIST',
          description: 'Base (Canvas) Resolution',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '1280x720',
          values: [
            { '1920x1080': '1920x1080' },
            { '1280x720': '1280x720' },
            { '1080x1920': '1080x1920' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Output',
          type: 'OBS_INPUT_RESOLUTION_LIST',
          description: 'Output (Scaled) Resolution',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '640x360',
          values: [
            { '1280x720': '1280x720' },
            { '1024x576': '1024x576' },
            { '960x540': '960x540' },
            { '852x480': '852x480' },
            { '768x432': '768x432' },
            { '730x410': '730x410' },
            { '640x360': '640x360' },
            { '568x320': '568x320' },
            { '512x288': '512x288' },
            { '464x260': '464x260' },
            { '426x240': '426x240' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'ScaleType',
          type: 'OBS_PROPERTY_LIST',
          description: 'Downscale Filter',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'bicubic',
          values: [
            { 'Bilinear (Fastest, but blurry if scaling)': 'bilinear' },
            { 'Bicubic (Sharpened scaling, 16 samples)': 'bicubic' },
            { 'Lanczos (Sharpened scaling, 32 samples)': 'lanczos' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'FPSType',
          type: 'OBS_PROPERTY_LIST',
          description: 'FPS Type',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'Common FPS Values',
          values: [
            { 'Common FPS Values': 'Common FPS Values' },
            { 'Integer FPS Value': 'Integer FPS Value' },
            { 'Fractional FPS Value': 'Fractional FPS Value' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'FPSCommon',
          type: 'OBS_PROPERTY_LIST',
          description: 'Common FPS Values',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '60',
          values: [
            { '10': '10' },
            { '20': '20' },
            { '24 NTSC': '24 NTSC' },
            { '29.97': '29.97' },
            { '30': '30' },
            { '48': '48' },
            { '59.94': '59.94' },
            { '60': '60' }
          ],
          visible: true,
          enabled: false,
          masked: false
        }
      ]
    }
  ],
  type: 0
}
```

## Output
```
{
  data: [
    {
      nameSubCategory: 'Untitled',
      parameters: [
        {
          name: 'Mode',
          type: 'OBS_PROPERTY_LIST',
          description: 'Output Mode',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'Advanced',
          values: [ { Simple: 'Simple' }, { Advanced: 'Advanced' } ],
          visible: true,
          enabled: false,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Streaming',
      parameters: [
        {
          name: 'TrackIndex',
          type: 'OBS_PROPERTY_LIST',
          description: 'Audio Track',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '1',
          values: [
            { '1': '1' },
            { '2': '2' },
            { '3': '3' },
            { '4': '4' },
            { '5': '5' },
            { '6': '6' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'VodTrackEnabled',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Twitch VOD',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Encoder',
          type: 'OBS_PROPERTY_LIST',
          description: 'Encoder',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'obs_x264',
          values: [
            { 'Software (x264)': 'obs_x264' },
            { 'Hardware (NVENC)': 'ffmpeg_nvenc' },
            { 'Hardware (NVENC) (new)': 'jim_nvenc' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'ApplyServiceSettings',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Enforce streaming service encoder settings',
          subType: '',
          currentValue: true,
          values: [],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Rescale',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Rescale Output',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'rate_control',
          type: 'OBS_PROPERTY_LIST',
          description: 'Rate Control',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'CBR',
          values: [
            { CBR: 'CBR' },
            { ABR: 'ABR' },
            { VBR: 'VBR' },
            { CRF: 'CRF' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'bitrate',
          type: 'OBS_PROPERTY_INT',
          description: 'Bitrate',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 2500,
          minVal: 50,
          maxVal: 10000000,
          stepVal: 50,
          values: [
            { CBR: 'CBR' },
            { ABR: 'ABR' },
            { VBR: 'VBR' },
            { CRF: 'CRF' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'use_bufsize',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Use Custom Buffer Size',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: false,
          values: [
            { CBR: 'CBR' },
            { ABR: 'ABR' },
            { VBR: 'VBR' },
            { CRF: 'CRF' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'buffer_size',
          type: 'OBS_PROPERTY_INT',
          description: 'Buffer Size',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 2500,
          minVal: 0,
          maxVal: 10000000,
          stepVal: 1,
          values: [
            { CBR: 'CBR' },
            { ABR: 'ABR' },
            { VBR: 'VBR' },
            { CRF: 'CRF' }
          ],
          visible: false,
          enabled: false,
          masked: false
        },
        {
          name: 'crf',
          type: 'OBS_PROPERTY_INT',
          description: 'CRF',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 23,
          minVal: 0,
          maxVal: 51,
          stepVal: 1,
          values: [
            { CBR: 'CBR' },
            { ABR: 'ABR' },
            { VBR: 'VBR' },
            { CRF: 'CRF' }
          ],
          visible: false,
          enabled: false,
          masked: false
        },
        {
          name: 'keyint_sec',
          type: 'OBS_PROPERTY_INT',
          description: 'Keyframe Interval (seconds, 0=auto)',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 0,
          minVal: 0,
          maxVal: 20,
          stepVal: 1,
          values: [
            { CBR: 'CBR' },
            { ABR: 'ABR' },
            { VBR: 'VBR' },
            { CRF: 'CRF' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'preset',
          type: 'OBS_PROPERTY_LIST',
          description: 'CPU Usage Preset (higher = less CPU)',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'veryfast',
          values: [
            { ultrafast: 'ultrafast' },
            { superfast: 'superfast' },
            { veryfast: 'veryfast' },
            { faster: 'faster' },
            { fast: 'fast' },
            { medium: 'medium' },
            { slow: 'slow' },
            { slower: 'slower' },
            { veryslow: 'veryslow' },
            { placebo: 'placebo' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'profile',
          type: 'OBS_PROPERTY_LIST',
          description: 'Profile',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '',
          values: [
            { '(None)': '' },
            { baseline: 'baseline' },
            { main: 'main' },
            { high: 'high' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'tune',
          type: 'OBS_PROPERTY_LIST',
          description: 'Tune',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '',
          values: [
            { '(None)': '' },
            { film: 'film' },
            { animation: 'animation' },
            { grain: 'grain' },
            { stillimage: 'stillimage' },
            { psnr: 'psnr' },
            { ssim: 'ssim' },
            { fastdecode: 'fastdecode' },
            { zerolatency: 'zerolatency' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'x264opts',
          type: 'OBS_PROPERTY_TEXT',
          description: 'x264 Options (separated by space)',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '',
          values: [
            { '(None)': '' },
            { film: 'film' },
            { animation: 'animation' },
            { grain: 'grain' },
            { stillimage: 'stillimage' },
            { psnr: 'psnr' },
            { ssim: 'ssim' },
            { fastdecode: 'fastdecode' },
            { zerolatency: 'zerolatency' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'repeat_headers',
          type: 'OBS_PROPERTY_BOOL',
          description: 'repeat_headers',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: false,
          values: [
            { '(None)': '' },
            { film: 'film' },
            { animation: 'animation' },
            { grain: 'grain' },
            { stillimage: 'stillimage' },
            { psnr: 'psnr' },
            { ssim: 'ssim' },
            { fastdecode: 'fastdecode' },
            { zerolatency: 'zerolatency' }
          ],
          visible: false,
          enabled: false,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Recording',
      parameters: [
        {
          name: 'RecType',
          type: 'OBS_PROPERTY_LIST',
          description: 'Type',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'Standard',
          values: [ { Standard: 'Standard' } ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'RecFilePath',
          type: 'OBS_PROPERTY_PATH',
          description: 'Recording Path',
          subType: '',
          currentValue: 'D:\\wow-recorder-files\\.temp',
          values: [],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'RecFileNameWithoutSpace',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Generate File Name without Space',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'RecFormat',
          type: 'OBS_PROPERTY_LIST',
          description: 'Recording Format',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'mp4',
          values: [
            { mp4: 'mp4' },
            { flv: 'flv' },
            { mov: 'mov' },
            { mkv: 'mkv' },
            { ts: 'ts' },
            { m3u8: 'm3u8' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'RecTracks',
          type: 'OBS_PROPERTY_BITMASK',
          description: 'Audio Track',
          subType: '',
          currentValue: 63,
          minVal: -200,
          maxVal: 200,
          stepVal: 1,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'RecEncoder',
          type: 'OBS_PROPERTY_LIST',
          description: 'Recording',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'jim_nvenc',
          values: [
            { 'Use stream encoder': 'none' },
            { 'Software (x264)': 'obs_x264' },
            { 'Hardware (NVENC)': 'ffmpeg_nvenc' },
            { 'Hardware (NVENC) (new)': 'jim_nvenc' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'RecRescale',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Rescale Output',
          subType: '',
          currentValue: false,
          values: [],
          visible: false,
          enabled: false,
          masked: false
        },
        {
          name: 'RecMuxerCustom',
          type: 'OBS_PROPERTY_EDIT_TEXT',
          description: 'Custom Muxer Settings',
          subType: '',
          currentValue: '',
          values: [],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Recrate_control',
          type: 'OBS_PROPERTY_LIST',
          description: 'Rate Control',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'VBR',
          values: [
            { CBR: 'CBR' },
            { CQP: 'CQP' },
            { VBR: 'VBR' },
            { Lossless: 'lossless' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Recbitrate',
          type: 'OBS_PROPERTY_INT',
          description: 'Bitrate',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 15360,
          minVal: 50,
          maxVal: 300000,
          stepVal: 50,
          values: [
            { CBR: 'CBR' },
            { CQP: 'CQP' },
            { VBR: 'VBR' },
            { Lossless: 'lossless' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Recmax_bitrate',
          type: 'OBS_PROPERTY_INT',
          description: 'Max Bitrate',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 300000,
          minVal: 50,
          maxVal: 300000,
          stepVal: 50,
          values: [
            { CBR: 'CBR' },
            { CQP: 'CQP' },
            { VBR: 'VBR' },
            { Lossless: 'lossless' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Reccqp',
          type: 'OBS_PROPERTY_INT',
          description: 'CQ Level',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 20,
          minVal: 1,
          maxVal: 30,
          stepVal: 1,
          values: [
            { CBR: 'CBR' },
            { CQP: 'CQP' },
            { VBR: 'VBR' },
            { Lossless: 'lossless' }
          ],
          visible: false,
          enabled: false,
          masked: false
        },
        {
          name: 'Reckeyint_sec',
          type: 'OBS_PROPERTY_INT',
          description: 'Keyframe Interval (seconds, 0=auto)',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 0,
          minVal: 0,
          maxVal: 10,
          stepVal: 1,
          values: [
            { CBR: 'CBR' },
            { CQP: 'CQP' },
            { VBR: 'VBR' },
            { Lossless: 'lossless' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Recpreset',
          type: 'OBS_PROPERTY_LIST',
          description: 'Preset',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'hq',
          values: [
            { 'Max Quality': 'mq' },
            { Quality: 'hq' },
            { Performance: 'default' },
            { 'Max Performance': 'hp' },
            { 'Low-Latency': 'll' },
            { 'Low-Latency Quality': 'llhq' },
            { 'Low-Latency Performance': 'llhp' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Recprofile',
          type: 'OBS_PROPERTY_LIST',
          description: 'Profile',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'high',
          values: [
            { high: 'high' },
            { main: 'main' },
            { baseline: 'baseline' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Reclookahead',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Look-ahead',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: false,
          values: [
            { high: 'high' },
            { main: 'main' },
            { baseline: 'baseline' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Recrepeat_headers',
          type: 'OBS_PROPERTY_BOOL',
          description: 'repeat_headers',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: false,
          values: [
            { high: 'high' },
            { main: 'main' },
            { baseline: 'baseline' }
          ],
          visible: false,
          enabled: false,
          masked: false
        },
        {
          name: 'Recpsycho_aq',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Psycho Visual Tuning',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: true,
          values: [
            { high: 'high' },
            { main: 'main' },
            { baseline: 'baseline' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Recgpu',
          type: 'OBS_PROPERTY_INT',
          description: 'GPU',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 0,
          minVal: 0,
          maxVal: 8,
          stepVal: 1,
          values: [
            { high: 'high' },
            { main: 'main' },
            { baseline: 'baseline' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Recbf',
          type: 'OBS_PROPERTY_INT',
          description: 'Max B-frames',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 2,
          minVal: 0,
          maxVal: 4,
          stepVal: 1,
          values: [
            { high: 'high' },
            { main: 'main' },
            { baseline: 'baseline' }
          ],
          visible: true,
          enabled: false,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Audio - Track 1',
      parameters: [
        {
          name: 'Track1Bitrate',
          type: 'OBS_PROPERTY_LIST',
          description: 'Audio Bitrate',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '160',
          values: [
            { '64': '64' },
            { '96': '96' },
            { '128': '128' },
            { '160': '160' },
            { '192': '192' },
            { '224': '224' },
            { '256': '256' },
            { '288': '288' },
            { '320': '320' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Track1Name',
          type: 'OBS_PROPERTY_EDIT_TEXT',
          description: 'Name',
          subType: '',
          currentValue: 'Mixed: all sources',
          values: [],
          visible: true,
          enabled: false,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Audio - Track 2',
      parameters: [
        {
          name: 'Track2Bitrate',
          type: 'OBS_PROPERTY_LIST',
          description: 'Audio Bitrate',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '160',
          values: [
            { '64': '64' },
            { '96': '96' },
            { '128': '128' },
            { '160': '160' },
            { '192': '192' },
            { '224': '224' },
            { '256': '256' },
            { '288': '288' },
            { '320': '320' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Track2Name',
          type: 'OBS_PROPERTY_EDIT_TEXT',
          description: 'Name',
          subType: '',
          currentValue: 'Microphone (3- G533 Gaming Headset)',
          values: [],
          visible: true,
          enabled: false,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Audio - Track 3',
      parameters: [
        {
          name: 'Track3Bitrate',
          type: 'OBS_PROPERTY_LIST',
          description: 'Audio Bitrate',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '160',
          values: [
            { '64': '64' },
            { '96': '96' },
            { '128': '128' },
            { '160': '160' },
            { '192': '192' },
            { '224': '224' },
            { '256': '256' },
            { '288': '288' },
            { '320': '320' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Track3Name',
          type: 'OBS_PROPERTY_EDIT_TEXT',
          description: 'Name',
          subType: '',
          currentValue: 'BenQ GW2480 (NVIDIA High Definition Audio)',
          values: [],
          visible: true,
          enabled: false,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Audio - Track 4',
      parameters: [
        {
          name: 'Track4Bitrate',
          type: 'OBS_PROPERTY_LIST',
          description: 'Audio Bitrate',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '160',
          values: [
            { '64': '64' },
            { '96': '96' },
            { '128': '128' },
            { '160': '160' },
            { '192': '192' },
            { '224': '224' },
            { '256': '256' },
            { '288': '288' },
            { '320': '320' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Track4Name',
          type: 'OBS_PROPERTY_EDIT_TEXT',
          description: 'Name',
          subType: '',
          currentValue: 'Digital Audio (S/PDIF) (High Definition Audio Device)',
          values: [],
          visible: true,
          enabled: false,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Audio - Track 5',
      parameters: [
        {
          name: 'Track5Bitrate',
          type: 'OBS_PROPERTY_LIST',
          description: 'Audio Bitrate',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '160',
          values: [
            { '64': '64' },
            { '96': '96' },
            { '128': '128' },
            { '160': '160' },
            { '192': '192' },
            { '224': '224' },
            { '256': '256' },
            { '288': '288' },
            { '320': '320' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Track5Name',
          type: 'OBS_PROPERTY_EDIT_TEXT',
          description: 'Name',
          subType: '',
          currentValue: 'Speakers (3- G533 Gaming Headset)',
          values: [],
          visible: true,
          enabled: false,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Audio - Track 6',
      parameters: [
        {
          name: 'Track6Bitrate',
          type: 'OBS_PROPERTY_LIST',
          description: 'Audio Bitrate',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '160',
          values: [
            { '64': '64' },
            { '96': '96' },
            { '128': '128' },
            { '160': '160' },
            { '192': '192' },
            { '224': '224' },
            { '256': '256' },
            { '288': '288' },
            { '320': '320' }
          ],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'Track6Name',
          type: 'OBS_PROPERTY_EDIT_TEXT',
          description: 'Name',
          subType: '',
          currentValue: 'BenQ GW2480 (NVIDIA High Definition Audio)',
          values: [],
          visible: true,
          enabled: false,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Replay Buffer',
      parameters: [
        {
          name: 'RecRB',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Enable Replay Buffer',
          subType: '',
          currentValue: true,
          values: [],
          visible: true,
          enabled: false,
          masked: false
        },
        {
          name: 'RecRBTime',
          type: 'OBS_PROPERTY_INT',
          description: 'Maximum Replay Time (Seconds)',
          subType: '',
          currentValue: 20,
          minVal: 0,
          maxVal: 21599,
          stepVal: 0,
          values: [],
          visible: true,
          enabled: false,
          masked: false
        }
      ]
    }
  ],
  type: 1
}
```

## Audio
```
{
  data: [
    {
      nameSubCategory: 'Untitled',
      parameters: [
        {
          name: 'SampleRate',
          type: 'OBS_PROPERTY_LIST',
          description: 'Sample Rate (requires a restart)',
          subType: 'OBS_COMBO_FORMAT_INT',
          currentValue: 44100,
          minVal: -200,
          maxVal: 200,
          stepVal: 1,
          values: [ { '44.1khz': 44100 }, { '48khz': 48000 } ],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'ChannelSetup',
          type: 'OBS_PROPERTY_LIST',
          description: 'Channels (requires a restart)',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'Stereo',
          values: [
            { Mono: 'Mono' },
            { Stereo: 'Stereo' },
            { '2.1': '2.1' },
            { '4.0': '4.0' },
            { '4.1': '4.1' },
            { '5.1': '5.1' },
            { '7.1': '7.1' }
          ],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    }
  ],
  type: 0
}
```

## Advanced
```
data: [
    {
      nameSubCategory: 'General',
      parameters: [
        {
          name: 'ProcessPriority',
          type: 'OBS_PROPERTY_LIST',
          description: 'Process Priority',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'Normal',
          values: [
            { High: 'High' },
            { 'Above Normal': 'AboveNormal' },
            { Normal: 'Normal' },
            { 'Below Normal': 'BelowNormal' },
            { Idle: 'Idle' }
          ],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Video',
      parameters: [
        {
          name: 'ColorFormat',
          type: 'OBS_PROPERTY_LIST',
          description: 'Color Format',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'NV12',
          values: [
            { NV12: 'NV12' },
            { I420: 'I420' },
            { I444: 'I444' },
            { RGB: 'RGB' }
          ],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'ColorSpace',
          type: 'OBS_PROPERTY_LIST',
          description: 'YUV Color Space',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: '601',
          values: [ { '601': '601' }, { '709': '709' } ],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'ColorRange',
          type: 'OBS_PROPERTY_LIST',
          description: 'YUV Color Range',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'Partial',
          values: [ { Partial: 'Partial' }, { Full: 'Full' } ],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'ForceGPUAsRenderDevice',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Force GPU as render device',
          subType: '',
          currentValue: true,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Audio',
      parameters: [
        {
          name: 'MonitoringDeviceName',
          type: 'OBS_PROPERTY_LIST',
          description: 'Audio Monitoring Device',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'Default',
          values: [
            { Default: 'Default' },
            {
              'BenQ GW2480 (NVIDIA High Definition Audio)': 'BenQ GW2480 (NVIDIA High Definition Audio)'
            },
            {
              'Digital Audio (S/PDIF) (High Definition Audio Device)': 'Digital Audio (S/PDIF) (High Definition Audio Device)'
            },
            {
              'Speakers (3- G533 Gaming Headset)': 'Speakers (3- G533 Gaming Headset)'
            },
            {
              'BenQ GW2480 (NVIDIA High Definition Audio)': 'BenQ GW2480 (NVIDIA High Definition Audio)'
            }
          ],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'DisableAudioDucking',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Disable Windows audio ducking',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Recording',
      parameters: [
        {
          name: 'FilenameFormatting',
          type: 'OBS_PROPERTY_EDIT_TEXT',
          description: 'Filename Formatting',
          subType: '',
          currentValue: '%CCYY-%MM-%DD %hh-%mm-%ss',
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'OverwriteIfExists',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Overwrite if file exists',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Replay Buffer',
      parameters: [
        {
          name: 'RecRBPrefix',
          type: 'OBS_PROPERTY_EDIT_TEXT',
          description: 'Replay Buffer Filename Prefix',
          subType: '',
          currentValue: 'Replay',
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'RecRBSuffix',
          type: 'OBS_PROPERTY_EDIT_TEXT',
          description: 'Replay Buffer Filename Suffix',
          subType: '',
          currentValue: '',
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Stream Delay',
      parameters: [
        {
          name: 'DelayEnable',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Enable',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'DelaySec',
          type: 'OBS_PROPERTY_INT',
          description: 'Duration (seconds)',
          subType: '',
          currentValue: 20,
          minVal: 0,
          maxVal: 1800,
          stepVal: 0,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'DelayPreserve',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Preserved cutoff point (increase delay) when reconnecting',
          subType: '',
          currentValue: true,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Automatically Reconnect',
      parameters: [
        {
          name: 'Reconnect',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Enable',
          subType: '',
          currentValue: true,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'RetryDelay',
          type: 'OBS_PROPERTY_INT',
          description: 'Retry Delay (seconds)',
          subType: '',
          currentValue: 10,
          minVal: 0,
          maxVal: 30,
          stepVal: 0,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'MaxRetries',
          type: 'OBS_PROPERTY_INT',
          description: 'Maximum Retries',
          subType: '',
          currentValue: 20,
          minVal: 0,
          maxVal: 10000,
          stepVal: 0,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Network',
      parameters: [
        {
          name: 'BindIP',
          type: 'OBS_PROPERTY_LIST',
          description: 'Bind to IP',
          subType: 'OBS_COMBO_FORMAT_STRING',
          currentValue: 'default',
          values: [
            { Default: 'default' },
            {
              '[Ethernet] 2a00:23c8:75a6:ab01:bf7a:f4cf:9148:d7dc': '2a00:23c8:75a6:ab01:bf7a:f4cf:9148:d7dc'
            },
            {
              '[Ethernet] 2a00:23c8:75a6:ab01:6963:4a2b:896d:8e2a': '2a00:23c8:75a6:ab01:6963:4a2b:896d:8e2a'
            },
            {
              '[Ethernet] fe80::65b8:61b9:a3e6:17c6': 'fe80::65b8:61b9:a3e6:17c6'
            },
            { '[Ethernet] 192.168.1.108': '192.168.1.108' }
          ],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'DynamicBitrate',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Dynamically change bitrate when dropping frames while streaming',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'NewSocketLoopEnable',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Enable new networking code',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        },
        {
          name: 'LowLatencyEnable',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Low latency mode',
          subType: '',
          currentValue: false,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Sources',
      parameters: [
        {
          name: 'browserHWAccel',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Enable Browser Source Hardware Acceleration (requires a restart)',
          subType: '',
          currentValue: true,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    },
    {
      nameSubCategory: 'Media Files',
      parameters: [
        {
          name: 'fileCaching',
          type: 'OBS_PROPERTY_BOOL',
          description: 'Enable media file caching',
          subType: '',
          currentValue: true,
          values: [],
          visible: true,
          enabled: true,
          masked: false
        }
      ]
    }
  ],
  type: 0
}
```