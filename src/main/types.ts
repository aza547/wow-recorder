import { Size } from 'electron';
import { Language } from '../localisation/translations';
import { RawChallengeModeTimelineSegment } from './keystone';
import { VideoCategory } from '../types/VideoCategory';
import ConfigService from '../config/ConfigService';
import { Tag } from 'react-tag-autocomplete';

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
 * When we retrieve state from the WR API, we have a few additional entries
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
  selectedVideos: RendererVideo[];
  multiPlayerMode: boolean;
  videoFilterTags: Tag[];
  videoFullScreen: boolean;
  playing: boolean;
  language: Language;
  cloudStatus: CloudStatus;
  diskStatus: DiskStatus;
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
  HARDWARE,
  SOFTWARE,
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
};

type ObsVideoConfig = {
  obsCaptureMode: string;
  monitorIndex: number;
  captureCursor: boolean;
};

type ObsOverlayConfig = {
  chatOverlayEnabled: boolean;
  chatOverlayOwnImage: boolean;
  chatOverlayOwnImagePath: string;
  chatOverlayWidth: number;
  chatOverlayHeight: number;
  chatOverlayScale: number;
  chatOverlayXPosition: number;
  chatOverlayYPosition: number;

  // While not strictly overlay config, we need this to determine
  // if it's valid to have a custom overlay (which is a paid feature).
  cloudStorage: boolean;
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
  recordRetailPtr: boolean;
  retailPtrLogPath: string;
};

type CloudConfig = {
  cloudStorage: boolean;
  cloudUpload: boolean;
  cloudAccountName: string;
  cloudAccountPassword: string;
  cloudGuildName: string;
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
  usage: number;
  limit: number;
  guilds: string[];
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
  TAudioSourceType,
  AppState,
  RawCombatant,
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
  CloudConfig,
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
  IBrowserWindow,
  UploadQueueItem,
  CloudMetadata,
  CloudSignedMetadata,
  CreateMultiPartUploadResponseBody,
  CompleteMultiPartUploadRequestBody,
};
