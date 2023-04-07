import { Size } from 'electron';
import { ChallengeModeTimelineSegment } from './keystone';
import Combatant from './Combatant';
import { VideoCategory } from '../types/VideoCategory';
import { ConfigurationSchema } from './configSchema';

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
};

type VideoQueueItem = {
  bufferFile: string;
  metadata: Metadata;
  filename: string;
  relativeStart: number;
};

interface IEventTarget {
  name: string;
  value: any;
}

/**
 * Class to fake an event for onChange in `ISettingsPanelProps`
 */
class FakeChangeEvent {
  public target: IEventTarget;

  constructor(name: string, value: any) {
    this.target = { name, value };
  }
}

interface IOurChangeEvent {
  target: IEventTarget;
}

interface ISettingsPanelProps {
  config: ConfigurationSchema;
  onChange: (event: IOurChangeEvent) => void;
}

/**
 * Metadata type.
 */
type Metadata = {
  category: VideoCategory;
  duration: number;
  result: boolean;
  flavour: Flavour;
  zoneID?: number;
  zoneName?: string;
  encounterID?: number;
  difficultyID?: number;
  difficulty?: string;
  player?: Combatant;
  teamMMR?: number;
  deaths?: PlayerDeathType[];
  upgradeLevel?: number;
  mapID?: number;
  timeline?: ChallengeModeTimelineSegment[] | SoloShuffleTimelineSegment[];
  level?: number;
  encounterName?: string;
  protected?: boolean;
  soloShuffleRoundsWon?: number;
  soloShuffleRoundsPlayed?: number;
  combatants?: Combatant[];
  overrun: number;
};

/**
 * VideoData type. Unused for now.
 */
type VideoData = Metadata & {
  date: string;
  time: string;
  path: string;
  protected: boolean;
};

type SoloShuffleTimelineSegment = {
  round: number;
  timestamp: number;
  result: boolean;
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
 * Tracks the position of the app and the navigator component. A value
 * of -1 for either of the fields here indicates no selection for the field.
 */
type TNavigatorState = {
  categoryIndex: number;
  videoIndex: number;
};

/**
 * Some bits of application state.
 */
type TAppState = {
  fatalError: boolean;
  fatalErrorText: string;
  numVideosDisplayed: number;
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
  FakeChangeEvent,
  ISettingsPanelProps,
  Metadata,
  VideoData,
  Flavour,
  SoloShuffleTimelineSegment,
  EDeviceType,
  IOBSDevice,
  IDevice,
  TAudioSourceType,
  TNavigatorState,
  TAppState,
};
