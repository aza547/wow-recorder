import { Size } from "electron";

/**
 * Application status
 */
enum AppStatus {
    WaitingForWoW,
    Recording,
    InvalidConfig,
    ReadyToRecord,
    SavingVideo,
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
    AFFILIATION_MASK = 0x0000000F,
    // Reaction
    REACTION_FRIENDLY = 0x00000010,
    REACTION_NEUTRAL = 0x00000020,
    REACTION_HOSTILE = 0x00000040,
    REACTION_MASK = 0x000000F0,
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
    TYPE_MASK = 0x0000FC00,
    // Special cases (non-exclusive)
    TARGET = 0x00010000,
    FOCUS = 0x00020000,
    MAINTANK = 0x00040000,
    MAINASSIST = 0x00080000,
    NONE = 0x80000000, // Whether the unit does not exist.
    SPECIAL_MASK = 0xFFFF0000,
};

/**
 * Type that describes the player deaths that are detected and stored
 * with the metadata for a video.
 */
type PlayerDeathType = {
  name: string,
  specId: number,
  timestamp: number,
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
};

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
    id: number,
    index: number,
    physicalPosition: string,
    primary: boolean,
    displayFrequency: number,
    depthPerComponent: number,
    size: Size,
    physicalSize: Size,
    aspectRatio: number,
    scaleFactor: number,
};

type NumberKeyToStringValueMapType = {
    [id: number]: string;
};

type RaidInstanceType = {
    zoneId: number;
    name: string;
    encounters: NumberKeyToStringValueMapType,
};

type FileInfo = {
    name: string;
    size: number;
    mtime: number;
};

export {
    AppStatus,
    UnitFlags,
    PlayerDeathType,
    VideoPlayerSettings,
    FileSortDirection,
    OurDisplayType,
    NumberKeyToStringValueMapType,
    RaidInstanceType,
    FileInfo,
    FileFinderCallbackType,
}
