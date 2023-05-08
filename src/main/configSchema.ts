export type ConfigurationSchema = {
  storagePath: string;
  bufferStoragePath: string;
  retailLogPath: string;
  classicLogPath: string;
  maxStorage: number;
  monitorIndex: number;
  selectedCategory: number;
  audioInputDevices: string;
  audioOutputDevices: string;
  minEncounterDuration: number;
  startUp: boolean;
  startMinimized: boolean;
  obsOutputResolution: string;
  obsFPS: number;
  obsForceMono: boolean;
  obsKBitRate: number;
  obsCaptureMode: string; // 'game_capture' or 'monitor_capture'
  obsRecEncoder: string;
  recordRetail: boolean;
  recordClassic: boolean;
  recordRaids: boolean;
  recordDungeons: boolean;
  recordTwoVTwo: boolean;
  recordThreeVThree: boolean;
  recordFiveVFive: boolean;
  recordSkirmish: boolean;
  recordSoloShuffle: boolean;
  recordBattlegrounds: boolean;
  captureCursor: boolean;
  minKeystoneLevel: number;
  minRaidDifficulty: string;
  minimizeOnQuit: boolean;
  minimizeToTray: boolean;
  chatOverlayEnabled: boolean;
  chatOverlayWidth: number;
  chatOverlayHeight: number;
  chatOverlayXPosition: number;
  chatOverlayYPosition: number;
  speakerVolume: number;
  micVolume: number;
};

export type ConfigurationSchemaKey = keyof ConfigurationSchema;

/**
 * Config schema. The descriptions included here get displayed in the UI.
 */
export const configSchema = {
  storagePath: {
    description: 'Location to store the recordings.',
    type: 'string',
    default: '',
  },
  bufferStoragePath: {
    description:
      'Location to store temporary recordings. If left unset this will default to a temporary folder inside the Storage Path.',
    type: 'string',
  },
  retailLogPath: {
    description:
      'Location of the World of Warcraft logs folder for your retail installation, e.g. "D:\\World of Warcraft\\_retail_\\Logs".',
    type: 'string',
    default: '',
  },
  classicLogPath: {
    description:
      'Location of the World of Warcraft logs folder for your classic installation, e.g. "D:\\World of Warcraft\\_classic_\\Logs".',
    type: 'string',
    default: '',
  },
  maxStorage: {
    description:
      'Maximum allowed storage that the application will consume for video files. The oldest videos will be deleted one by one to remain under the limit. Recording will not stop. Set to 0 to signify unlimited.',
    type: 'integer',
    default: 200,
    minimum: 0,
  },
  monitorIndex: {
    description: 'The monitor to record.',
    type: 'integer',
    default: 1,
    minimum: 1,
    maximum: 4,
  },
  selectedCategory: {
    description: 'Last selected video category in the UI.',
    type: 'integer',
    default: 1,
  },
  audioInputDevices: {
    description: 'Audio input devices to be included in the recording.',
    type: 'string',
    default: '',
  },
  audioOutputDevices: {
    description: 'Audio output devices to be included in the recording.',
    type: 'string',
    default: '',
  },
  minEncounterDuration: {
    description:
      'Minimum raid boss encounter duration, encounters shorter than this will not be recorded. This setting is aimed at avoiding saving boss resets.',
    type: 'integer',
    default: 15,
    maximum: 10000,
  },
  startUp: {
    description: 'Automatically start the application when Windows starts.',
    type: 'boolean',
    default: false,
  },
  startMinimized: {
    description: 'Open to the Windows system tray.',
    type: 'boolean',
    default: false,
  },
  obsOutputResolution: {
    description:
      'Resolution of videos as saved on disk. Smaller resolution gives smaller video size, but can look grainy/pixelated. Typically just set this to the size of your WoW monitor',
    type: 'string',
    default: '1920x1080',
  },
  obsFPS: {
    description:
      'The number of frames per second to record the video at. Lower FPS gives smaller video size, but also more choppy playback.',
    type: 'integer',
    default: 60,
    minimum: 15,
    maximum: 60,
  },
  obsForceMono: {
    description:
      'Whether to force the audio of your input device to mono. Enable if your microphone audio is only playing out of one stereo channel.',
    type: 'boolean',
    default: true,
  },
  obsKBitRate: {
    description:
      'Bit rate to record at. Lower bit rate values give smaller video size but worse video quality. Suggested values are found below.',
    type: 'integer',
    default: 15,
    minimum: 1,
    maximum: 300,
  },
  obsCaptureMode: {
    description:
      'Game capture records the game directly but is limited in that only one OBS process can use game capture at a time. If you are also streaming with OBS Studio you may wish to use monitor capture here.',
    type: 'string',
    default: 'game_capture',
  },
  obsRecEncoder: {
    description:
      'The video encoder to use. Hardware encoders are typically preferable, usually giving better performance, but are specific to your graphics card.',
    type: 'string',
    default: 'obs_x264',
  },
  recordRetail: {
    description: 'Whether the application should record retail.',
    type: 'boolean',
    default: true,
  },
  recordClassic: {
    description: 'Whether the application should record classic.',
    type: 'boolean',
    default: true,
  },
  recordRaids: {
    description: 'Whether the application should record raids.',
    type: 'boolean',
    default: true,
  },
  recordDungeons: {
    description: 'Whether the application should record Mythic+.',
    type: 'boolean',
    default: true,
  },
  recordTwoVTwo: {
    description: 'Whether the application should record 2v2.',
    type: 'boolean',
    default: true,
  },
  recordThreeVThree: {
    description: 'Whether the application should record 3v3.',
    type: 'boolean',
    default: true,
  },
  recordFiveVFive: {
    description: 'Whether the application should record 5v5.',
    type: 'boolean',
    default: true,
  },
  recordSkirmish: {
    description: 'Whether the application should record skirmishes.',
    type: 'boolean',
    default: true,
  },
  recordSoloShuffle: {
    description: 'Whether the application should record solo shuffle.',
    type: 'boolean',
    default: true,
  },
  recordBattlegrounds: {
    description: 'Whether the application should record battlegrounds.',
    type: 'boolean',
    default: true,
  },
  captureCursor: {
    description: 'Whether the cursor should be included in recordings.',
    type: 'boolean',
    default: false,
  },
  minKeystoneLevel: {
    description: 'The minimum keystone level to record.',
    type: 'integer',
    default: 2,
  },
  minRaidDifficulty: {
    description:
      'The minimum raid difficulty to record, this setting only applies to retail.',
    type: 'string',
    default: 'LFR',
  },
  minimizeOnQuit: {
    description: 'Whether the close button should minimize rather than quit.',
    type: 'boolean',
    default: true,
  },
  minimizeToTray: {
    description:
      'Whether the minimize button should minimize to the system tray or the taskbar.',
    type: 'boolean',
    default: true,
  },
  chatOverlayEnabled: {
    description: 'If a chat overlay should be added to the scene.',
    type: 'boolean',
    default: false,
  },
  chatOverlayWidth: {
    description: 'The width of the chat overlay.',
    type: 'integer',
    default: 700,
  },
  chatOverlayHeight: {
    description: 'The height of the chat overlay.',
    type: 'integer',
    default: 230,
  },
  chatOverlayXPosition: {
    description: 'The x-position of the chat overlay.',
    type: 'integer',
    default: 0,
  },
  chatOverlayYPosition: {
    description: 'The y-position of the chat overlay.',
    type: 'integer',
    default: 870,
  },
  speakerVolume: {
    description: 'The volume of your speakers in the recording, from 0 to 1.',
    type: 'integer',
    default: 1,
  },
  micVolume: {
    description: 'The volume of your mic in the recording, from 0 to 1.',
    type: 'integer',
    default: 1,
  },
};
