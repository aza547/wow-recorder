import { Size } from 'electron';
import { Language } from '../localisation/translations';
import { RawChallengeModeTimelineSegment } from './keystone';
import { VideoCategory } from '../types/VideoCategory';
import { Tag } from 'react-tag-autocomplete';
import { DateValueType } from 'react-tailwindcss-datepicker';
import { QualityPresets } from './obsEnums';

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
  Overrunning,
  Reconfiguring,
}

type ActivityStatus = {
  category: VideoCategory;
  start: number;
};

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
 * We display any OBS crashes on the frontend so we don't silently recover
 * and have the user think all is well.
 */
type ErrorReport = {
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
  sortDirection?: FileSortDirection,
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
  name: string; // Can an OBS timestamp if recording or more complicated if clipping.
  source: string; // Can be either a path or a URL.
  suffix: string; // Typically details of the recording, but can also be a "clipped at ..." description.
  offset: number;
  duration: number;
  clip: boolean;
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
  clippedAt?: number; // epoch time of clipping
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
  level?: number; // back compatibility pre-cloud
  keystoneLevel?: number;
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
  bossPercent?: number;
  appVersion?: string;
};

/**
 * We mandata some fields are present for cloud videos that are optional for
 * disk based videos.
 */
type CloudMetadata = Metadata & {
  videoName: string;
  videoKey: string;
  start: number;
  uniqueHash: string;
};

/**
 * When we retrieve state from the WCR API, we have a few additional entries
 * in the data, these are signed by the API so that we can read them without
 * the client having credentials.
 */
type CloudSignedMetadata = CloudMetadata & {
  signedVideoKey: string;
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
  _region?: string;
};

/**
 * Frontend metadata type, this is Metadata above plus a bunch of fields we
 * add when reading the file.
 */
type RendererVideo = Metadata & {
  videoName: string;
  mtime: number;
  videoSource: string;
  isProtected: boolean;
  cloud: boolean;
  multiPov: RendererVideo[];

  // Used by frontend to uniquely identify a video, as videoName
  // is identical for a disk and cloud viewpoint.
  uniqueId: string;
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

enum AudioSourceType {
  OUTPUT = 'wasapi_output_capture',
  INPUT = 'wasapi_input_capture',
  PROCESS = 'wasapi_process_output_capture',
}

type AudioSource = {
  id: string; // The source name
  type: AudioSourceType;
  friendly?: string; // A user-friendly name for the source
  device?: string | number; // Machine friendly identifier for the device or window, I think this can only be a string in practice.
  volume: number; // Current volume setting (0-1)
};

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
 * Storage filtering options.
 */
enum StorageFilter {
  DISK = 'Disk',
  CLOUD = 'Cloud',
  BOTH = 'Both',
}

/**
 * The state of the frontend.
 */
type AppState = {
  page: Pages;
  category: VideoCategory;
  selectedVideos: RendererVideo[];
  multiPlayerMode: boolean;
  viewpointSelectionOpen: boolean;
  videoFilterTags: Tag[];
  dateRangeFilter: DateValueType;
  storageFilter: StorageFilter;
  videoFullScreen: boolean;
  playing: boolean;
  language: Language;
  cloudStatus: CloudStatus;
  diskStatus: DiskStatus;
  chatOpen: boolean;
  preferredViewpoint: string;
};

type CloudState = {
  uploadProgress: number;
  downloadProgress: number;
  queuedUploads: number;
  queuedDownloads: number;
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
  PROCESS,
}

enum EncoderType {
  HARDWARE,
  SOFTWARE,
}

type Encoder = {
  name: string;
  value: string;
  type: EncoderType;
};

type BaseConfig = {
  storagePath: string;
  maxStorage: number;
  obsPath: string;
  obsOutputResolution: string;
  obsFPS: number;
  obsQuality: string;
  obsRecEncoder: string;
  recordRetail: boolean;
  retailLogPath: string;
  recordClassic: boolean;
  recordClassicPtr: boolean;
  classicLogPath: string;
  classicPtrLogPath: string;
  recordEra: boolean;
  eraLogPath: string;
  recordRetailPtr: boolean;
  retailPtrLogPath: string;
  validateLogPaths: boolean;
};

type ObsVideoConfig = {
  obsCaptureMode: string;
  monitorIndex: number;
  captureCursor: boolean;
  forceSdr: boolean;
  videoSourceScale: number;
  videoSourceXPosition: number;
  videoSourceYPosition: number;
};

type ObsOverlayConfig = {
  chatOverlayEnabled: boolean;
  chatOverlayOwnImage: boolean;
  chatOverlayOwnImagePath: string;
  chatOverlayScale: number;
  chatOverlayXPosition: number;
  chatOverlayYPosition: number;
  chatOverlayCropX: number;
  chatOverlayCropY: number;
};

type ObsAudioConfig = {
  audioSources: AudioSource[];
  obsAudioSuppression: boolean;
  obsForceMono: boolean;
  pushToTalk: boolean;
  pushToTalkKey: number;
  pushToTalkMouseButton: number;
  pushToTalkModifiers: string;
};

type CloudConfig = {
  cloudStorage: boolean;
  cloudUpload: boolean;
  cloudAccountName: string;
  cloudAccountPassword: string;
  cloudGuildName: string;
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
  enabled: boolean;
  authenticated: boolean;
  authorized: boolean;
  guild: string;
  available: string[];
  read: boolean; // Always true for now.
  write: boolean;
  del: boolean;
  usage: number;
  limit: number;
};

type DiskStatus = {
  usage: number;
  limit: number;
};

type CloudObject = {
  key: string;
  size: number;
  lastMod: Date;
};

interface IBrowserWindow {
  webContents: {
    send: (channel: string) => void;
  };
}

type UploadQueueItem = {
  path: string;
};

type KillVideoQueueItem = {
  width: number;
  height: number;
  quality: QualityPresets;
  fps: number;
  segments: KillVideoSegment[];
};

type KillVideoSegment = {
  video: RendererVideo;
  start: number;
  stop: number;
};

type CreateMultiPartUploadResponseBody = {
  urls: string[];
};

type CompleteMultiPartUploadRequestBody = {
  etags: string[];
  key: string;
};

export interface ISettingsSubCategory {
  nameSubCategory: string;
  codeSubCategory?: string;
  parameters: TObsFormData;
}

export type TObsStringList = { value: string }[];

export interface IObsFont {
  face?: string;
  flags?: number;
  size?: number;
  path?: string;
  style?: string;
}

export declare type TObsValue =
  | number
  | string
  | boolean
  | IObsFont
  | TObsStringList;

export declare type TObsType =
  | 'OBS_PROPERTY_BOOL'
  | 'OBS_PROPERTY_INT'
  | 'OBS_PROPERTY_LIST'
  | 'OBS_PROPERTY_PATH'
  | 'OBS_PROPERTY_FILE'
  | 'OBS_PROPERTY_EDIT_TEXT'
  | 'OBS_PROPERTY_TEXT'
  | 'OBS_PROPERTY_UINT'
  | 'OBS_PROPERTY_COLOR'
  | 'OBS_PROPERTY_DOUBLE'
  | 'OBS_PROPERTY_FLOAT'
  | 'OBS_PROPERTY_SLIDER'
  | 'OBS_PROPERTY_FONT'
  | 'OBS_PROPERTY_EDITABLE_LIST'
  | 'OBS_PROPERTY_BUTTON'
  | 'OBS_PROPERTY_BITMASK'
  | 'OBS_INPUT_RESOLUTION_LIST';

export interface IObsInput<TValueType> {
  value: TValueType;
  currentValue?: TValueType;
  name: string;
  description: string;
  showDescription?: boolean;
  enabled?: boolean;
  visible?: boolean;
  masked?: boolean;
  type: TObsType;
}

export interface IObsListOption<TValue> {
  description: string;
  value: TValue;
}

export interface IObsListInput<TValue> extends IObsInput<TValue> {
  options: IObsListOption<TValue>[];
}

export declare type TObsFormData = (
  | IObsInput<TObsValue>
  | IObsListInput<TObsValue>
)[];

type ObsSourceCallbackInfo = {
  name: string;
  width: number;
  height: number;
  flags: number;
};

type ObsVolmeterCallbackInfo = {
  sourceName: string;
  magnitude: number[];
  peak: number[];
  inputPeak: number[];
};

enum SceneItem {
  OVERLAY = 'Overlay',
  GAME = 'Game',
}

enum SceneInteraction {
  NONE,
  MOVE,
  SCALE,
}

type BoxDimensions = {
  x: number;
  y: number;
  width: number;
  height: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
};

enum VideoSourceName {
  WINDOW = 'WCR Window Capture',
  GAME = 'WCR Game Capture',
  MONITOR = 'WCR Monitor Capture',
  OVERLAY = 'WCR Chat Overlay',
}

enum AudioSourcePrefix {
  SPEAKER = 'WCR Speaker Capture',
  MIC = 'WCR Mic Capture',
  PROCESS = 'WCR Process Capture',
}

enum WowProcessEvent {
  STARTED = 'wowProcessStart',
  STOPPED = 'wowProcessStop',
}

enum SoundAlerts {
  MANUAL_RECORDING_ERROR = 'manual-recording-error',
  MANUAL_RECORDING_START = 'manual-recording-start',
  MANUAL_RECORDING_STOP = 'manual-recording-stop',
}

export {
  RecStatus,
  SaveStatus,
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
  AudioSourceType,
  AppState,
  RawCombatant,
  TPreviewPosition,
  DeviceType,
  Pages,
  EncoderType,
  Encoder,
  BaseConfig,
  ObsVideoConfig,
  ObsOverlayConfig,
  ObsAudioConfig,
  CloudConfig,
  DeathMarkers,
  VideoMarker,
  MarkerColors,
  MicStatus,
  ErrorReport,
  SliderMark,
  CloudStatus,
  DiskStatus,
  CloudObject,
  IBrowserWindow,
  UploadQueueItem,
  CloudMetadata,
  CloudSignedMetadata,
  CreateMultiPartUploadResponseBody,
  CompleteMultiPartUploadRequestBody,
  StorageFilter,
  ObsSourceCallbackInfo,
  ObsVolmeterCallbackInfo,
  VideoSourceName,
  AudioSource,
  AudioSourcePrefix,
  SceneItem,
  SceneInteraction,
  BoxDimensions,
  WowProcessEvent,
  SoundAlerts,
  CloudState,
  ActivityStatus,
  KillVideoQueueItem,
  KillVideoSegment,
};
