import { Size } from 'electron';
import { RawChallengeModeTimelineSegment } from './keystone';
import { VideoCategory } from '../types/VideoCategory';
import ConfigService from './ConfigService';

/**
 * Application recording status.
 */
enum Flavour {
  Retail = 'Retail',
  Classic = 'Classic',
}

/**
 * Application recording status.
 */
enum RecStatus {
  WaitingForWoW,
  Recording,
  InvalidConfig,
  ReadyToRecord,
  FatalError,
  Overruning,
}

enum MicStatus {
  NONE,
  MUTED,
  LISTENING,
}

/**
 * Application saving status.
 */
enum SaveStatus {
  Saving,
  NotSaving,
}

/**
 * Application saving status.
 */
type UpgradeStatus = {
  available: boolean;
  link: string | undefined;
};

/**
 * We display any OBS crashes on the frontend so we don't silently recover
 * and have the user think all is well.
 */
type Crashes = CrashData[];

type CrashData = {
  date: Date;
  reason: string;
};

/**
 * Unit flags from combat log events
 * See https://wowpedia.fandom.com/wiki/UnitFlag for more information
 */
enum UnitFlags {
  AFFILIATION_MINE = 0x00000001,
  AFFILIATION_PARTY = 0x00000002,
  AFFILIATION_RAID = 0x00000004,
  AFFILIATION_OUTSIDER = 0x00000008,
  AFFILIATION_MASK = 0x0000000f,
  // Reaction
  REACTION_FRIENDLY = 0x00000010,
  REACTION_NEUTRAL = 0x00000020,
  REACTION_HOSTILE = 0x00000040,
  REACTION_MASK = 0x000000f0,
  // Controller
  CONTROL_PLAYER = 0x00000100,
  CONTROL_NPC = 0x00000200,
  CONTROL_MASK = 0x00000300,
  // Type
  TYPE_PLAYER = 0x00000400, // Units directly controlled by players.
  TYPE_NPC = 0x00000800, // Units controlled by the server.
  TYPE_PET = 0x00001000, // Pets are units controlled by a player or NPC, including via mind control.
  TYPE_GUARDIAN = 0x00002000, // Units that are not controlled, but automatically defend their master.
  TYPE_OBJECT = 0x00004000, // Objects are everything else, such as traps and totems.
  TYPE_MASK = 0x0000fc00,
  // Special cases (non-exclusive)
  TARGET = 0x00010000,
  FOCUS = 0x00020000,
  MAINTANK = 0x00040000,
  MAINASSIST = 0x00080000,
  NONE = 0x80000000, // Whether the unit does not exist.
  SPECIAL_MASK = 0xffff0000,
}

/**
 * Type that describes the player deaths that are detected and stored
 * with the metadata for a video.
 */
type PlayerDeathType = {
  name: string;
  specId: number;
  date: Date;
  timestamp: number;
  friendly: boolean;
};

/**
 * Type that describes selected video player settings that we want to keep
 * across changes in the UI like selecting a new video, new category, etc.
 */
type VideoPlayerSettings = {
  muted: boolean;
  volume: number;
};

enum FileSortDirection {
  NewestFirst,
  OldestFirst,
}

/**
 * Signature for the file finder getSortedFiles() to be used as typing
 * for methods/classes that accept it being injected.
 */
type FileFinderCallbackType = (
  dir: string,
  pattern: string,
  sortDirection?: FileSortDirection
) => Promise<FileInfo[]>;

/**
 * Specifies the format that we use in Settings to display monitors
 * to the user.
 */
type OurDisplayType = {
  id: number;
  index: number;
  physicalPosition: string;
  primary: boolean;
  displayFrequency: number;
  depthPerComponent: number;
  size: Size;
  physicalSize: Size;
  aspectRatio: number;
  scaleFactor: number;
};

type NumberKeyToStringValueMapType = {
  [id: number]: string;
};

type StringKeyToNumberValueMapType = {
  [id: string]: number;
};

type RaidInstanceType = {
  zoneId: number;
  name: string;
  shortName: string;
  encounters: NumberKeyToStringValueMapType;
};

type FileInfo = {
  name: string;
  size: number;
  mtime: number;
  birthTime: number;
};

type VideoQueueItem = {
  source: string;
  suffix: string;
  offset: number;
  duration: number;
  deleteSource: boolean;
  metadata: Metadata;
};

/**
 * This is what we write to the .json files. We use "raw" subtypes here to
 * represent any classes as writing entire classes to JSON files causes
 * problems on the frontend.
 */
type Metadata = {
  category: VideoCategory;
  parentCategory?: VideoCategory; // present if it's a clip
  duration: number;
  start?: number; // epoch start time of activity
  result: boolean;
  flavour: Flavour;
  zoneID?: number;
  zoneName?: string;
  encounterID?: number;
  difficultyID?: number;
  difficulty?: string;
  player?: RawCombatant;
  teamMMR?: number;
  deaths?: PlayerDeathType[];
  upgradeLevel?: number;
  mapID?: number;
  challengeModeTimeline?: RawChallengeModeTimelineSegment[];
  soloShuffleTimeline?: SoloShuffleTimelineSegment[];
  level?: number;
  encounterName?: string;
  protected?: boolean;
  soloShuffleRoundsWon?: number;
  soloShuffleRoundsPlayed?: number;
  combatants: RawCombatant[];
  overrun: number;
  affixes?: number[];
  tag?: string;
  delete?: boolean; // signals video should be deleted when possible
  uniqueHash?: string; // used for cloud video grouping
};

/**
 * All fields in the raw type can be undefined to force us to check them
 * before use. In theory anything can be present or not present in the
 * metadata files.
 */
type RawCombatant = {
  _GUID?: string;
  _teamID?: number;
  _specID?: number;
  _name?: string;
  _realm?: string;
};

/**
 * Frontend metadata type, this is Metadata above plus a bunch of fields we
 * add when reading the file.
 */
type RendererVideo = Metadata & {
  name: string;
  mtime: number;
  videoSource: string;
  thumbnailSource: string;
  isProtected: boolean;
  size: number;
  cloud: boolean;
  multiPov: RendererVideo[];
};

type SoloShuffleTimelineSegment = {
  round: number;
  timestamp: number;
  result: boolean;
  duration?: number;
};

enum EDeviceType {
  audioInput = 'audioInput',
  audioOutput = 'audioOutput',
  videoInput = 'videoInput',
}

interface IOBSDevice {
  id: string;
  description: string;
}

interface IDevice {
  id: string;
  type: EDeviceType;
  description: string;
}

enum TAudioSourceType {
  input = 'wasapi_input_capture',
  output = 'wasapi_output_capture',
}

/**
 * If we should be showing a certain page. This always takes priority over anything
 * else in TNavigatorState.
 */
enum Pages {
  'None',
  'SceneEditor',
  'Settings',
}

/**
 * The state of the frontend.
 */
type AppState = {
  page: Pages;
  category: VideoCategory;
  playingVideo: RendererVideo | undefined; // the video being played by the player
  selectedVideoName: string | undefined;
  videoFilterQuery: string;
  videoFullScreen: boolean;
};

type TPreviewPosition = {
  width: number;
  height: number;
  xPos: number;
  yPos: number;
};

enum DeviceType {
  INPUT,
  OUTPUT,
}

enum EncoderType {
  HARDWARE = 'Hardware',
  SOFTWARE = 'Software',
}

type Encoder = {
  name: string;
  type: EncoderType;
};

type ObsBaseConfig = {
  storagePath: string;
  maxStorage: number;
  obsPath: string;
  obsOutputResolution: string;
  obsFPS: number;
  obsQuality: string;
  obsRecEncoder: string;
  cloudStorage: boolean;
  cloudUpload: boolean;
  cloudAccountName: string;
  cloudAccountPassword: string;
  cloudGuildName: string;
};

type ObsVideoConfig = {
  obsCaptureMode: string;
  monitorIndex: number;
  captureCursor: boolean;
};

type ObsOverlayConfig = {
  chatOverlayEnabled: boolean;
  chatOverlayWidth: number;
  chatOverlayHeight: number;
  chatOverlayXPosition: number;
  chatOverlayYPosition: number;
};

type ObsAudioConfig = {
  audioInputDevices: string;
  audioOutputDevices: string;
  obsForceMono: boolean;
  speakerVolume: number;
  micVolume: number;
  pushToTalk: boolean;
  pushToTalkKey: number;
  pushToTalkMouseButton: number;
  pushToTalkModifiers: string;
  obsAudioSuppression: boolean;
};

type FlavourConfig = {
  recordRetail: boolean;
  retailLogPath: string;
  recordClassic: boolean;
  classicLogPath: string;
  recordEra: boolean;
  eraLogPath: string;
};

type ConfigStage = {
  name: string;
  valid: boolean;
  current: any;
  get: (cfg: ConfigService) => any;
  configure: (...args: any[]) => Promise<void>;
  validate: (...args: any[]) => Promise<void>;
};

enum DeathMarkers {
  NONE = 'None',
  OWN = 'Own',
  ALL = 'All',
}

enum MarkerColors {
  WIN = 'rgba(30, 255, 0, 1)',
  LOSS = 'rgba(255, 0, 0, 1)',
  ENCOUNTER = 'rgba(163, 53, 238, 1)',
}

type VideoMarker = {
  time: number;
  duration: number;
  text: string;
  color: string;
};

type SliderMark = {
  value: number;
  label: JSX.Element;
};

type CloudStatus = {
  usageGB: number;
  maxUsageGB: number;
};

type DiskStatus = {
  usageGB: number;
  maxUsageGB: number;
};

type CloudObject = {
  key: string;
  size: number;
  lastMod: Date;
};

interface ICloudClient {
  list: () => Promise<CloudObject[]>;
  delete: (key: string) => Promise<void>;
}

interface IBrowserWindow {
  webContents: {
    send: (channel: string) => void;
  };
}

type UploadQueueItem = {
  path: string;
  category: string;
  start: number;
};

export {
  RecStatus,
  SaveStatus,
  UpgradeStatus,
  UnitFlags,
  PlayerDeathType,
  VideoPlayerSettings,
  FileSortDirection,
  OurDisplayType,
  NumberKeyToStringValueMapType,
  StringKeyToNumberValueMapType,
  RaidInstanceType,
  FileInfo,
  FileFinderCallbackType,
  VideoQueueItem,
  Metadata,
  RendererVideo,
  Flavour,
  SoloShuffleTimelineSegment,
  EDeviceType,
  IOBSDevice,
  IDevice,
  TAudioSourceType,
  AppState,
  RawCombatant,
  RawChallengeModeTimelineSegment,
  TPreviewPosition,
  DeviceType,
  Pages,
  EncoderType,
  Encoder,
  ObsBaseConfig,
  ObsVideoConfig,
  ObsOverlayConfig,
  ObsAudioConfig,
  FlavourConfig,
  ConfigStage,
  DeathMarkers,
  VideoMarker,
  MarkerColors,
  MicStatus,
  Crashes,
  CrashData,
  SliderMark,
  CloudStatus,
  DiskStatus,
  CloudObject,
  ICloudClient,
  IBrowserWindow,
  UploadQueueItem,
};
