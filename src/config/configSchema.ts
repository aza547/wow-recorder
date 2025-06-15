import { Phrase } from 'localisation/translations';

export type ConfigurationSchema = {
  storagePath: string;
  bufferStoragePath: string;
  separateBufferPath: boolean;
  retailLogPath: string;
  classicLogPath: string;
  eraLogPath: string;
  retailPtrLogPath: string;
  maxStorage: number;
  monitorIndex: number;
  selectedCategory: number;
  audioInputDevices: string;
  audioOutputDevices: string;
  audioProcessDevices: { value: string; label: string }[];
  minEncounterDuration: number;
  startUp: boolean;
  startMinimized: boolean;
  obsOutputResolution: string;
  obsFPS: number;
  obsForceMono: boolean;
  obsQuality: string;
  obsCaptureMode: string; // 'window_capture' or 'game_capture' or 'monitor_capture'
  obsRecEncoder: string;
  recordRetail: boolean;
  recordClassic: boolean;
  recordEra: boolean;
  recordRetailPtr: boolean;
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
  chatOverlayOwnImage: boolean;
  chatOverlayOwnImagePath: string;
  chatOverlayWidth: number;
  chatOverlayHeight: number;
  chatOverlayScale: number;
  chatOverlayXPosition: number;
  chatOverlayYPosition: number;
  speakerVolume: number;
  micVolume: number;
  processVolume: number;
  deathMarkers: number;
  encounterMarkers: boolean;
  roundMarkers: boolean;
  pushToTalk: boolean;
  pushToTalkKey: number;
  pushToTalkMouseButton: number;
  pushToTalkModifiers: string;
  obsAudioSuppression: boolean;
  raidOverrun: number;
  dungeonOverrun: number;
  cloudStorage: boolean;
  cloudUpload: boolean;
  cloudUploadRetail: boolean;
  cloudUploadClassic: boolean;
  cloudUploadRateLimit: boolean;
  cloudUploadRateLimitMbps: number;
  cloudAccountName: string;
  cloudAccountPassword: string;
  cloudGuildName: string;
  cloudUpload2v2: boolean;
  cloudUpload3v3: boolean;
  cloudUpload5v5: boolean;
  cloudUploadSkirmish: boolean;
  cloudUploadSoloShuffle: boolean;
  cloudUploadDungeons: boolean;
  cloudUploadRaids: boolean;
  cloudUploadBattlegrounds: boolean;
  cloudUploadRaidMinDifficulty: string;
  cloudUploadDungeonMinLevel: number;
  cloudUploadClips: boolean;
  language: string;
  hideEmptyCategories: boolean;
  hardwareAcceleration: boolean;
  recordCurrentRaidEncountersOnly: boolean;
  uploadCurrentRaidEncountersOnly: boolean;
};

export type ConfigurationSchemaKey = keyof ConfigurationSchema;

/**
 * Config schema. The descriptions included here may get displayed in the UI.
 */
export const configSchema = {
  storagePath: {
    description: Phrase.StoragePathDescription,
    type: 'string',
    default: '',
  },
  separateBufferPath: {
    description: Phrase.SeparateBufferPathDescription,
    type: 'boolean',
    default: false,
  },
  bufferStoragePath: {
    description: Phrase.BufferStoragePathDescription,
    type: 'string',
    default: '',
  },
  retailLogPath: {
    description: Phrase.RetailLogPathDescription,
    type: 'string',
    default: '',
  },
  classicLogPath: {
    description: Phrase.ClassicLogPathDescription,
    type: 'string',
    default: '',
  },
  eraLogPath: {
    description: Phrase.EraLogPathDescription,
    type: 'string',
    default: '',
  },
  retailPtrLogPath: {
    description: Phrase.RetailPtrLogPathDescription,
    type: 'string',
    default: '',
  },
  maxStorage: {
    description: Phrase.MaxStorageDescription,
    type: 'integer',
    default: 50,
    minimum: 0,
  },
  monitorIndex: {
    description: Phrase.MonitorIndexDescription,
    type: 'integer',
    default: 1,
    minimum: 1,
    maximum: 4,
  },
  selectedCategory: {
    description: Phrase.SelectedCategoryDescription,
    type: 'integer',
    default: 1,
  },
  audioInputDevices: {
    description: Phrase.AudioInputDevicesDescription,
    type: 'string',
    default: 'default',
  },
  audioOutputDevices: {
    description: Phrase.AudioOutputDevicesDescription,
    type: 'string',
    default: 'default',
  },
  audioProcessDevices: {
    description: Phrase.AudioProcessDevicesDescription,
    type: 'array',
    default: [],
  },
  minEncounterDuration: {
    description: Phrase.MinEncounterDurationDescription,
    type: 'integer',
    default: 15,
    maximum: 10000,
  },
  startUp: {
    description: Phrase.StartUpDescription,
    type: 'boolean',
    default: false,
  },
  startMinimized: {
    description: Phrase.StartMinimizedDescription,
    type: 'boolean',
    default: false,
  },
  obsOutputResolution: {
    description: Phrase.ObsOutputResolutionDescription,
    type: 'string',
    default: '1920x1080',
  },
  obsFPS: {
    description: Phrase.ObsFPSDescription,
    type: 'integer',
    default: 60,
    minimum: 15,
    maximum: 60,
  },
  obsForceMono: {
    description: Phrase.ObsForceMonoDescription,
    type: 'boolean',
    default: true,
  },
  obsQuality: {
    description: Phrase.ObsQualityDescription,
    type: 'string',
    default: 'Moderate',
  },
  obsCaptureMode: {
    description: Phrase.ObsCaptureModeDescription,
    type: 'string',
    default: 'window_capture',
  },
  obsRecEncoder: {
    description: Phrase.ObsRecEncoderDescription,
    type: 'string',
    default: 'obs_x264',
  },
  recordRetail: {
    description: Phrase.RecordRetailDescription,
    type: 'boolean',
    default: false,
  },
  recordClassic: {
    description: Phrase.RecordClassicDescription,
    type: 'boolean',
    default: false,
  },
  recordEra: {
    description: Phrase.RecordEraDescription,
    type: 'boolean',
    default: false,
  },
  recordRetailPtr: {
    description: Phrase.RecordRetailPtrDescription,
    type: 'boolean',
    default: false,
  },
  recordRaids: {
    description: Phrase.RecordRaidsDescription,
    type: 'boolean',
    default: true,
  },
  recordDungeons: {
    description: Phrase.RecordDungeonsDescription,
    type: 'boolean',
    default: true,
  },
  recordTwoVTwo: {
    description: Phrase.RecordTwoVTwoDescription,
    type: 'boolean',
    default: true,
  },
  recordThreeVThree: {
    description: Phrase.RecordThreeVThreeDescription,
    type: 'boolean',
    default: true,
  },
  recordFiveVFive: {
    description: Phrase.RecordFiveVFiveDescription,
    type: 'boolean',
    default: true,
  },
  recordSkirmish: {
    description: Phrase.RecordSkirmishDescription,
    type: 'boolean',
    default: true,
  },
  recordSoloShuffle: {
    description: Phrase.RecordSoloShuffleDescription,
    type: 'boolean',
    default: true,
  },
  recordBattlegrounds: {
    description: Phrase.RecordBattlegroundsDescription,
    type: 'boolean',
    default: true,
  },
  captureCursor: {
    description: Phrase.CaptureCursorDescription,
    type: 'boolean',
    default: false,
  },
  minKeystoneLevel: {
    description: Phrase.MinKeystoneLevelDescription,
    type: 'integer',
    default: 2,
  },
  minRaidDifficulty: {
    description: Phrase.MinRaidDifficultyDescription,
    type: 'string',
    default: 'LFR',
  },
  minimizeOnQuit: {
    description: Phrase.MinimizeOnQuitDescription,
    type: 'boolean',
    default: true,
  },
  minimizeToTray: {
    description: Phrase.MinimizeToTrayDescription,
    type: 'boolean',
    default: true,
  },
  chatOverlayEnabled: {
    description: Phrase.ChatOverlayEnabledDescription,
    type: 'boolean',
    default: false,
  },
  chatOverlayOwnImage: {
    description: Phrase.ChatOverlayOwnImageDescription,
    type: 'boolean',
    default: false,
  },
  chatOverlayOwnImagePath: {
    description: Phrase.ChatOverlayOwnImagePathDescription,
    type: 'string',
    default: '',
  },
  chatOverlayWidth: {
    description: Phrase.ChatOverlayWidthDescription,
    type: 'integer',
    default: 700,
  },
  chatOverlayHeight: {
    description: Phrase.ChatOverlayHeightDescription,
    type: 'integer',
    default: 230,
  },
  chatOverlayScale: {
    description: Phrase.ChatOverlayScaleDescription,
    type: 'integer',
    default: 1,
  },
  chatOverlayXPosition: {
    description: Phrase.ChatOverlayXPositionDescription,
    type: 'integer',
    default: 0,
  },
  chatOverlayYPosition: {
    description: Phrase.ChatOverlayYPositionDescription,
    type: 'integer',
    default: 870,
  },
  speakerVolume: {
    description: Phrase.SpeakerVolumeDescription,
    type: 'integer',
    default: 1,
  },
  micVolume: {
    description: Phrase.MicVolumeDescription,
    type: 'integer',
    default: 1,
  },
  processVolume: {
    description: Phrase.ProcessVolumeDescription,
    type: 'integer',
    default: 1,
  },
  deathMarkers: {
    description: Phrase.DeathMarkersDescription,
    type: 'integer',
    default: 1,
  },
  encounterMarkers: {
    description: Phrase.EncounterMarkersDescription,
    type: 'integer',
    default: true,
  },
  roundMarkers: {
    description: Phrase.RoundMarkersDescription,
    type: 'boolean',
    default: true,
  },
  pushToTalk: {
    description: Phrase.PushToTalkDescription,
    type: 'boolean',
    default: false,
  },
  pushToTalkKey: {
    description: Phrase.PushToTalkKeyDescription,
    type: 'integer',
    default: -1,
  },
  pushToTalkMouseButton: {
    description: Phrase.PushToTalkMouseButtonDescription,
    type: 'integer',
    default: -1,
  },
  pushToTalkModifiers: {
    description: Phrase.PushToTalkModifiersDescription,
    type: 'string',
    default: '',
  },
  obsAudioSuppression: {
    description: Phrase.ObsAudioSuppressionDescription,
    type: 'boolean',
    default: true,
  },
  raidOverrun: {
    description: Phrase.RaidOverrunDescription,
    type: 'integer',
    default: 15,
    minimum: 0,
    maximum: 60,
  },
  dungeonOverrun: {
    description: Phrase.DungeonOverrunDescription,
    type: 'integer',
    default: 5,
    minimum: 0,
    maximum: 60,
  },
  cloudStorage: {
    description: Phrase.CloudStorageDescription,
    type: 'boolean',
    default: false,
  },
  cloudUpload: {
    description: Phrase.CloudUploadDescription,
    type: 'boolean',
    default: false,
  },
  cloudUploadRetail: {
    description: Phrase.CloudUploadRetailDescription,
    type: 'boolean',
    default: true,
  },
  cloudUploadClassic: {
    description: Phrase.CloudUploadClassicDescription,
    type: 'boolean',
    default: true,
  },
  cloudUploadRateLimit: {
    description: Phrase.CloudUploadRateLimitDescription,
    type: 'boolean',
    default: false,
  },
  cloudUploadRateLimitMbps: {
    description: Phrase.CloudUploadRateLimitMbpsDescription,
    type: 'integer',
    default: 100,
  },
  cloudAccountName: {
    description: Phrase.CloudAccountNameDescription,
    type: 'string',
    default: '',
  },
  cloudAccountPassword: {
    description: Phrase.CloudAccountPasswordDescription,
    type: 'string',
    default: '',
  },
  cloudGuildName: {
    description: Phrase.CloudGuildNameDescription,
    type: 'string',
    default: '',
  },
  cloudUpload2v2: {
    description: Phrase.CloudUpload2v2Description,
    type: 'boolean',
    default: true,
  },
  cloudUpload3v3: {
    description: Phrase.CloudUpload3v3Description,
    type: 'boolean',
    default: true,
  },
  cloudUpload5v5: {
    description: Phrase.CloudUpload5v5Description,
    type: 'boolean',
    default: true,
  },
  cloudUploadSkirmish: {
    description: Phrase.CloudUploadSkirmishDescription,
    type: 'boolean',
    default: true,
  },
  cloudUploadSoloShuffle: {
    description: Phrase.CloudUploadSoloShuffleDescription,
    type: 'boolean',
    default: true,
  },
  cloudUploadDungeons: {
    description: Phrase.CloudUploadDungeonsDescription,
    type: 'boolean',
    default: true,
  },
  cloudUploadRaids: {
    description: Phrase.CloudUploadRaidsDescription,
    type: 'boolean',
    default: true,
  },
  cloudUploadBattlegrounds: {
    description: Phrase.CloudUploadBattlegroundsDescription,
    type: 'boolean',
    default: true,
  },
  cloudUploadRaidMinDifficulty: {
    description: Phrase.CloudUploadRaidMinDifficultyDescription,
    type: 'string',
    default: 'LFR',
  },
  cloudUploadDungeonMinLevel: {
    description: Phrase.CloudUploadDungeonMinLevelDescription,
    type: 'integer',
    default: 2,
  },
  cloudUploadClips: {
    description: Phrase.CloudUploadClipsDescription,
    type: 'boolean',
    default: true,
  },
  language: {
    description: Phrase.LanguageDescription,
    type: 'string',
    default: 'English',
  },
  hideEmptyCategories: {
    description: Phrase.HideEmptyCategoriesDescription,
    type: 'boolean',
    default: false,
  },
  hardwareAcceleration: {
    description: Phrase.HardwareAccelerationDescription,
    type: 'boolean',
    default: false,
  },
  recordCurrentRaidEncountersOnly: {
    description: Phrase.RecordCurrentRaidsOnlyDescription,
    type: 'boolean',
    default: false,
  },
  uploadCurrentRaidEncountersOnly: {
    description: Phrase.UploadCurrentRaidsOnlyDescription,
    type: 'boolean',
    default: false,
  },
};
