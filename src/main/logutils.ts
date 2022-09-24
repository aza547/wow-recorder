/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { Combatant } from './combatant';
import { recorder }  from './main';
import { battlegrounds, dungeonEncounters, dungeonsByMapId, dungeonTimersByMapId, VideoCategory, videoOverrunPerCategory }  from './constants';
import { PlayerDeathType, UnitFlags } from './types';
import { ChallengeModeDungeon, ChallengeModeTimelineSegment, TimelineSegmentType } from './keystone';
import { CombatLogParser, LogLine } from './combatLogParser';

const tasklist = require('tasklist');

let videoStartDate: Date;
let videoStopDate: Date;
let metadata: Metadata;
let combatantMap: Map<string, Combatant> = new Map();
let playerCombatant: Combatant | undefined;
let testRunning: boolean = false;
let activeChallengeMode: ChallengeModeDungeon | undefined;
let currentActivity: VideoCategory | undefined;

/**
 * Parser and handler for WoW combat log files
 * If no data has been received for 'dataTimeout' milliseconds, an event
 * will be emitted ('DataTimeout') to be able to clean up whatever was going on.
 */
const combatLogParser = new CombatLogParser({
    dataTimeout: 2 * 60 * 1000
});

/**
 * Log line handlers attached to their respective combat log event types.
 * Any combat log event is valid here.
 *
 * Callback signature is:
 *
 * (line: LogLine, flavour: string)
 *
 * 'flavour' is the WoW flavour like 'wow_classic', 'wow' (retail)
 */
combatLogParser
    .on('ARENA_MATCH_START', handleArenaStartLine)
    .on('ARENA_MATCH_END', handleArenaStopLine)
    .on('CHALLENGE_MODE_START', handleChallengeModeStartLine)
    .on('CHALLENGE_MODE_END', handleChallengeModeEndLine)
    .on('ENCOUNTER_START', handleEncounterStartLine)
    .on('ENCOUNTER_END', handleEncounterStopLine)
    .on('ZONE_CHANGE', handleZoneChange)
    .on('COMBATANT_INFO', handleCombatantInfoLine)
    .on('SPELL_AURA_APPLIED', handleSpellAuraAppliedLine)
    .on('UNIT_DIED', handleUnitDiedLine)
;

// If we haven't received data in a while, we're probably AFK and should stop recording.
combatLogParser.on('DataTimeout', (timeoutMs: number) => {
    console.log(`[CombatLogParser] Haven't received data for combatlog in ${timeoutMs / 1000} seconds.`)

    /**
     * End the current challenge mode dungeon and stop recording.
     * We'll keep the video.
     */
    if (activeChallengeMode) {
        forceStopRecording();
        return;
    }
});

/**
 * wowProcessStopped
 */
 type Metadata = {
    name: string;
    category: VideoCategory;
    zoneID?: number;
    encounterID?: number;
    difficultyID? : number;
    duration: number;
    result: boolean;
    playerName?: string;
    playerRealm?: string;
    playerSpecID?: number;
    teamMMR?: number;
    challengeMode?: ChallengeModeDungeon;
    playerDeaths: PlayerDeathType[];
}

/**
 * Is wow running? Starts false but we'll check immediately on start-up.
 */
let isRetailRunning: boolean = false;
let isClassicRunning: boolean = false;

/**
 * Timers for poll
 */
let pollWowProcessInterval: NodeJS.Timer;

/**
 * wowProcessStarted
 */
const wowProcessStarted = () => {
    console.log("[Logutils] Wow.exe is running");
    isRetailRunning = true;
    recorder.startBuffer();
};

/**
 * wowProcessStopped
 */
const wowProcessStopped = () => {
    console.log("[Logutils] Wow.exe has stopped");
    isRetailRunning = false;

    if (recorder.isRecording) {
        endRecording();
    } else if (recorder.isRecordingBuffer) {
        recorder.stopBuffer();
    }
};

/**
 * Initiate recording and mark as having something in-progress
 */
const startRecording = (category: VideoCategory) => {
    console.log(`[Logutils] Start recording a video for category: ${category}`)

    // Ensure combatant map and player combatant is clean before
    // starting a new recording.
    clearCombatants();

    currentActivity = category;
    recorder.start();
};

type EndRecordingOptionsType = {
    discardVideo?: boolean, // Discard the video/don't save the recording
    result?: boolean,       // Success/Failure result for the overall activity
};

/**
 * Stop recording and mark as not doing anything.
 */
const endRecording = (options?: EndRecordingOptionsType) => {
    if (!recorder.isRecording || !currentActivity) {
        return;
    }

    if (!videoStopDate) {
        videoStopDate = new Date();
    }

    const discardVideo = options?.discardVideo ?? false;
    const overrun = videoOverrunPerCategory[currentActivity];
    const videoDuration = (videoStopDate.getTime() - videoStartDate.getTime());

    metadata.duration = Math.round(videoDuration / 1000) + overrun;
    metadata.result = options?.result ?? false;

    if (playerCombatant) {
        metadata.playerName = playerCombatant.name;
        metadata.playerRealm = playerCombatant.realm;
        metadata.playerSpecID = playerCombatant.specID;
    }

    console.log(`[Logutils] Stop recording video for category: ${currentActivity}`)

    recorder.stop(metadata, overrun, discardVideo);
    currentActivity = undefined;
}

/**
 * Handle a line from the WoW log.
 */
function handleArenaStartLine (line: LogLine): void {
    if (recorder.isRecording) return;
    const category = (line.arg(3) as VideoCategory);
    const zoneID = parseInt(line.arg(1), 10);

    // If all goes to plan we don't need this but we do it incase the game
    // crashes etc. so we can still get a reasonable duration.
    videoStartDate = line.date();

    metadata = {
        name: "name",
        category: category,
        zoneID: zoneID,
        duration: 0,
        result: false,
        playerDeaths: []
    }

    startRecording(category);
}

/**
 * Handle a line from the WoW log.
 */
function handleArenaStopLine (line: LogLine): void {
    if (!recorder.isRecording) return;

    videoStopDate = line.date();
    
    const [result, MMR] = determineArenaMatchResult(line); 
    metadata.teamMMR = MMR;

    endRecording({result});
}

/**
 * Determines the arena match result.
 * @param line the line from the WoW log.
 * @returns [win: boolean, newRating: number]
 */
const determineArenaMatchResult = (line: LogLine): any[] => {
    if (playerCombatant === undefined) return [undefined, undefined];
    const teamID = playerCombatant.teamID;
    const indexForMMR = (teamID == 0) ? 3 : 4;
    const MMR = parseInt(line.arg(indexForMMR), 10);
    const winningTeamID = parseInt(line.arg(1), 10);
    const win = (teamID === winningTeamID)
    return [win, MMR];
}

/**
 * Handle a log line for CHALLENGE_MODE_START
 */
function handleChallengeModeStartLine (line: LogLine): void {
    // It's impossible to start a keystone dungeon while another one is in progress
    // so we'll just remove the existing one and make a new one when `CHALLENGE_MODE_START`
    // is encountered.
    if (activeChallengeMode) {
        console.warn("[ChallengeMode] A Challenge Mode instance is already in progress; abandoning it.")
    }
    videoStartDate = line.date();

    const zoneName = line.arg(2);
    const mapId = parseInt(line.arg(3), 10);
    const hasDungeonMap = (mapId in dungeonsByMapId);
    const hasTimersForDungeon = (mapId in dungeonTimersByMapId);

    if (!hasDungeonMap || !hasTimersForDungeon) {
        console.error(`[ChallengeMode] Invalid/unsupported mapId for Challenge Mode dungeon: ${mapId} ('${zoneName}')`)
    }

    const dungeonAffixes = line.arg(5).map((v: string) => parseInt(v, 10));

    activeChallengeMode = new ChallengeModeDungeon(
        dungeonTimersByMapId[mapId], // Dungeon timers
        parseInt(line.arg(2), 10),  // zoneId
        mapId,                       // mapId
        parseInt(line.arg(4), 10),  // Keystone Level
        dungeonAffixes,              // Array of affixes, as numbers
    )

    activeChallengeMode.addTimelineSegment(new ChallengeModeTimelineSegment(
        TimelineSegmentType.Trash, videoStartDate, 0
    ));

    console.debug("[ChallengeMode] Starting Challenge Mode instance")

    metadata = {
        name: line.arg(1), // Instance name (e.g. "Operation: Mechagon")
        encounterID: parseInt(line.arg(1), 10),
        category: VideoCategory.MythicPlus,
        zoneID: parseInt(line.arg(5)),
        duration: 0,
        result: false,
        challengeMode: activeChallengeMode,
        playerDeaths: [],
    };

    startRecording(VideoCategory.MythicPlus);
};

const endChallengeModeDungeon = (): void => {
    if (!activeChallengeMode) {
        return;
    }

    console.debug("[ChallengeMode] Ending current timeline segment")
    activeChallengeMode.endCurrentTimelineSegment(videoStopDate);

    // If last timeline segment is less than 10 seconds long, discard it.
    // It's probably not useful
    const lastTimelineSegment = activeChallengeMode.getCurrentTimelineSegment();
    if (lastTimelineSegment && lastTimelineSegment.length() < 10000) {
        console.debug("[ChallengeMode] Removing last timeline segment because it's too short.")
        activeChallengeMode.removeLastTimelineSegment();
    }

    console.debug("[ChallengeMode] Ending Challenge Mode instance");
    activeChallengeMode = undefined;
}

/**
 * Handle a log line for CHALLENGE_MODE_END
 */
function handleChallengeModeEndLine (line: LogLine): void {
    if (!recorder.isRecording || !activeChallengeMode) {
        return;
    }

    videoStopDate = line.date();

    // The actual log duration of the dungeon, from which keystone upgrade
    // levels can be calculated.
    //
    // It's included separate from `metadata.duration` because the duration of the
    // dungeon, as the game sees it, is what is important for this value to make sense.
    activeChallengeMode.duration = Math.round(parseInt(line.arg(4), 10) / 1000);

    // Calculate whether the key was timed or not
    activeChallengeMode.timed = ChallengeModeDungeon.calculateKeystoneUpgradeLevel(activeChallengeMode.allottedTime, activeChallengeMode.duration) > 0;

    endChallengeModeDungeon();

    const result = Boolean(parseInt(line.arg(1)));

    endRecording({result});
};

const getRelativeTimestampForTimelineSegment = (currentDate: Date): number => {
    if (!videoStartDate) {
        return 0;
    }

    return (currentDate.getTime() - videoStartDate.getTime()) / 1000;
};

/**
 * Handle a line from the WoW log.
 */
function handleEncounterStartLine (line: LogLine): void {
    const encounterID = parseInt(line.arg(1), 10)
    const difficultyID = parseInt(line.arg(3), 10);
    const eventDate = line.date();

    // If we're recording _and_ has an active challenge mode dungeon,
    // add a new boss encounter timeline segment.
    if (recorder.isRecording && activeChallengeMode) {
        const vSegment = new ChallengeModeTimelineSegment(
            TimelineSegmentType.BossEncounter,
            eventDate,
            getRelativeTimestampForTimelineSegment(eventDate),
            encounterID
        );

        activeChallengeMode.addTimelineSegment(vSegment, eventDate);
        console.debug(`[ChallengeMode] Starting new boss encounter: ${dungeonEncounters[encounterID]}`)

        return;
    }

    videoStartDate = eventDate;

    metadata = {
        name: "name",
        category: VideoCategory.Raids,
        encounterID: encounterID,
        difficultyID: difficultyID,
        duration: 0,
        result: false,
        playerDeaths: [],
    }

    startRecording(VideoCategory.Raids);
}

/**
 * Handle a line from the WoW log.
 */
function handleEncounterStopLine (line: LogLine): void {
    const eventDate = line.date();

    const result = Boolean(parseInt(line.arg(5), 10));
    const encounterID = parseInt(line.arg(1), 10);

    if (recorder.isRecording && activeChallengeMode) {
        const currentSegment = activeChallengeMode.getCurrentTimelineSegment()
        if (currentSegment) {
            currentSegment.result = result
        }

        const vSegment = new ChallengeModeTimelineSegment(
            TimelineSegmentType.Trash, eventDate, getRelativeTimestampForTimelineSegment(eventDate)
        )

        // Add a trash segment as the boss encounter ended
        activeChallengeMode.addTimelineSegment(vSegment, eventDate);
        console.debug(`[ChallengeMode] Ending boss encounter: ${dungeonEncounters[encounterID]}`)
        return;
    }

    videoStopDate = eventDate;

    endRecording({result});
}

/**
 * Handle a line from the WoW log.
 */
function handleZoneChange (line: LogLine): void {
    console.log("[Logutils] Handling zone change: ", line);
    const zoneID = parseInt(line.arg(1), 10);
    const isNewZoneBG = battlegrounds.hasOwnProperty(zoneID);
    const isRecording = recorder.isRecording;

    let isRecordingBG = false;
    let isRecordingArena = false;

    if (metadata !== undefined) {
        isRecordingBG = (metadata.category === VideoCategory.Battlegrounds);
        isRecordingArena = (metadata.category === VideoCategory.TwoVTwo) ||
                           (metadata.category === VideoCategory.ThreeVThree) ||
                           (metadata.category === VideoCategory.SoloShuffle) ||
                           (metadata.category === VideoCategory.Skirmish);
    }

    if (!isRecording && isNewZoneBG) {
        console.log("[Logutils] ZONE_CHANGE into BG, start recording");
        battlegroundStart(line);
        return;
    }
    if (isRecording && isRecordingBG && !isNewZoneBG) {
        console.log("[Logutils] ZONE_CHANGE out of BG, stop recording");
        battlegroundStop(line);
        return;
    }
    if (isRecording && isRecordingArena) {
        console.log("[Logutils] ZONE_CHANGE out of arena, stop recording");
        zoneChangeStop(line);
        return;
    }

    // TODO there is the case here where a tilted raider hearths
    // out mid-pull. I think the correct way to handle is just a
    // log inactivity stop, else raid encounters with ZONE_CHANGES
    // internally will always stop recording. That's a bit of work
    // so I'm skipping the implementation for now and making a
    // quick fix. For now, hearting out mid-encounter won't stop
    // the recording and the user will need to restart the app.
}

/**
 * Handles the SPELL_AURA_APPLIED line from WoW log.
 * @param line the SPELL_AURA_APPLIED line
 */
function handleSpellAuraAppliedLine (line: LogLine): void {
    if (playerCombatant) return;
    if (combatantMap.size === 0) return;

    const srcGUID = line.arg(1);
    const srcNameRealm = line.arg(2)
    const srcFlags = parseInt(line.arg(3), 16);

    const srcCombatant = combatantMap.get(srcGUID);
    if (srcCombatant === undefined) return;

    if (isUnitSelf(srcFlags)) {
        const [srcName, srcRealm] = ambiguate(srcNameRealm);
        srcCombatant.name = srcName;
        srcCombatant.realm = srcRealm;
        playerCombatant = srcCombatant;
    }
}

/**
 * Handles the COMBATANT_INFO line from WoW log by creating a Combatant and
 * adding it to combatantMap.
 * @param line the COMBATANT_INFO line
 */
function handleCombatantInfoLine (line: LogLine): void {
    const GUID = line.arg(1);
    const teamID = parseInt(line.arg(2), 10);
    const specID = parseInt(line.arg(24), 10);
    let combatantInfo = new Combatant(GUID, teamID, specID);
    combatantMap.set(GUID, combatantInfo);
}

/**
 * Return a combatant by guid, if it exists.
 */
function getCombatantByGuid(guid: string): Combatant | undefined {
    return combatantMap.get(guid);
}

/**
 * Clear combatants map and the current player combatant, if any.
 */
const clearCombatants = () => {
    combatantMap.clear();
    playerCombatant = undefined;
}

/**
 * ZONE_CHANGE event into a BG.
 */
function battlegroundStart (line: LogLine): void {
    const zoneID = parseInt(line.arg(1), 10);
    const battlegroundName = battlegrounds[zoneID];

    videoStartDate = line.date();

    metadata = {
        name: battlegroundName,
        category: VideoCategory.Battlegrounds,
        zoneID: zoneID,
        duration: 0,
        result: false,
        playerDeaths: [],
    }

    startRecording(VideoCategory.Battlegrounds);
}

/**
 * battlegroundStop
 */
function battlegroundStop (line: LogLine): void {
    videoStopDate = line.date();
    endRecording();
}

/**
 * zoneChangeStop
 */
function zoneChangeStop (line: LogLine): void {
    videoStopDate = line.date();
    endRecording();
}

/**
 * Register a player death in the video metadata
 */
const registerPlayerDeath = (timestamp: number, name: string, specId: number): void => {
    // Ensure a timestamp cannot be negative
    timestamp = timestamp >= 0 ? timestamp : 0;

    metadata.playerDeaths.push({ name, specId, timestamp });
}

/**
 * Handle a unit dying, but only if it's a player.
 */
 function handleUnitDiedLine (line: LogLine): void {
    // Only handle UNIT_DIED if we have a videoStartDate AND we're recording
    // We're not interested in player deaths outside of an active activity/recording.
    if (!videoStartDate || !recorder.isRecording) {
        return;
    }

    const unitFlags = parseInt(line.arg(7), 16);
    const isUnitUnconsciousAtDeath = Boolean(parseInt(line.arg(9), 10));

    // We only want player deaths and we don't want fake deaths,
    // i.e. a hunter that feigned death
    if (!isUnitPlayer(unitFlags) || isUnitUnconsciousAtDeath) {
        return;
    }

    const playerName = line.arg(6);
    const playerGuid = line.arg(5);
    const playerSpecId = getCombatantByGuid(playerGuid)?.specID ?? 0;

    // Add player death and subtract 2 seconds from the time of death to allow the
    // user to view a bit of the video before the death and not at the actual millisecond
    // it happens.
    const relativeTimeStamp = ((line.date().getTime() - 2) - videoStartDate.getTime()) / 1000;
    registerPlayerDeath(relativeTimeStamp, playerName, playerSpecId);
}

/**
 * Return whether the bitmask `flags` contain the bitmask `flag`
 */
const hasFlag = (flags: number, flag: number): boolean => {
    return (flags & flag) !== 0;
}

/**
 * Determine if the `flags` value indicate our own unit.
 * This is determined by the unit being a player and having the
 * flags `AFFILIATION_MINE` and `REACTION_FRIENDLY`.
 */
const isUnitSelf = (flags: number): boolean => {
    return isUnitPlayer(flags) && (
        hasFlag(flags, UnitFlags.REACTION_FRIENDLY) &&
        hasFlag(flags, UnitFlags.AFFILIATION_MINE)
    );
}

/**
* Determine if the unit is a player.
*
* See more here: https://wowpedia.fandom.com/wiki/UnitFlag
*/
const isUnitPlayer = (flags: number): boolean => {
    return (
        hasFlag(flags, UnitFlags.CONTROL_PLAYER) &&
        hasFlag(flags, UnitFlags.TYPE_PLAYER)
    );
}

/**
 * Split name and realm. Name stolen from:
 * https://wowpedia.fandom.com/wiki/API_Ambiguate
 * @param nameRealm string containing name and realm
 * @returns array containing name and realm
 */
 const ambiguate = (nameRealm: string): string[] => {
    const split = nameRealm.split("-");
    const name = split[0];
    const realm = split[1];
    return [name, realm];
}

/**
 * Forcibly stop recording and clean up whatever was going on
 */
const forceStopRecording = () => {
    const videoStopDate = new Date();
    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime());
    metadata.duration = Math.round(milliSeconds / 1000);

    // If a Keystone Dungeon is in progress, end it properly before we stop recording
    if (activeChallengeMode) {
        endChallengeModeDungeon();
    }

    // Clear all kinds of stuff that would prevent the app from starting another
    // recording
    clearCombatants();

    // Regardless of what happens above these lines, _ensure_ that these variables
    // are cleared.
    activeChallengeMode = undefined;
    testRunning = false;

    recorder.stop(metadata, 0);
}

/**
 * Watch the logs. Check every second for a new file, 
 * if there is, swap to watching that. 
 */
 const watchLogs = (logDirectories: string[]) => {
    logDirectories.forEach((logdir: string) => {
        combatLogParser.watchPath(logdir);
    })
}

/**
 * checkWoWProcess
 * @returns {[boolean, boolean]} retailRunning, classicRunning
 */
const checkWoWProcess = async (): Promise<[boolean, boolean]> => {
    let retailRunning = false;
    let classicRunning = false;

    const taskList = await tasklist();

    taskList.forEach((process: any) => {
        if (process.imageName === "Wow.exe") {
            retailRunning = true;
        } else if (process.imageName === "WowClassic.exe") {
            classicRunning = true;
        }
    });

    return [retailRunning, classicRunning]
}

/**
 * pollWoWProcessLogic
 */
const pollWoWProcessLogic = async (startup: boolean) => {
    const [retailFound, classicFound] = await checkWoWProcess();
    const retailProcessChanged = (retailFound !== isRetailRunning);
    // TODO classic support
    const classicProcessChanged = (classicFound !== isClassicRunning);
    const processChanged = (retailProcessChanged || classicProcessChanged);
    if (!retailProcessChanged && !startup) return;
    (retailFound) ? wowProcessStarted() : wowProcessStopped();
}

/**
 * pollWoWProcess
 */
const pollWowProcess = () => {
    pollWoWProcessLogic(true);
    if (pollWowProcessInterval) clearInterval(pollWowProcessInterval);
    pollWowProcessInterval = setInterval(() => pollWoWProcessLogic(false), 5000);
}

/**
 * Function to invoke if the user clicks the "run a test" button
 * in the GUI. Uses some sample log lines from 2v2.txt.
 */
const runRecordingTest = (endTest: boolean = true) => {
    console.log("[Logutils] User started a test!");
    if (!endTest) {
        console.log("[Logutils] The test will NOT end on its own and needs to be stopped manually.")
    }

    if (testRunning) {
        console.info("[Logutils] Test already running, not starting test.");
    }

    if (isRetailRunning) {
        console.info("[Logutils] WoW is running, starting test.");
        testRunning = true;
    } else {
        console.info("[Logutils] WoW isn't running, not starting test.");
        return;
    }

    /**
     * Return a combatlog formatted timestamp representing the current date/time
     * adjusted acording to `seconds` (which can be negative).
     */
    const getAdjustedDate = (seconds: number = 0): string => {
        const now = new Date(new Date().getTime() + (seconds * 1000));
        return `${now.getMonth() + 1}/${now.getDate()} ${now.toLocaleTimeString()}.000`
    };

    // This inserts a test date so that the recorder doesn't confuse itself with
    // dates too far in the past. This happens when a recording doesn't end on its own
    // and we forcibly stop it using `new Date()` instead of the date from a log line
    // that ends an activity.
    const startDate = getAdjustedDate();
    const endDate = getAdjustedDate(10);

    [
        startDate + "  ARENA_MATCH_START,2547,33,2v2,1",
        startDate + "  COMBATANT_INFO,Player-1084-08A89569,0,194,452,3670,2353,0,0,0,111,111,111,0,0,632,632,632,0,345,1193,1193,1193,779,256,(102351,102401,197491,5211,158478,203651,155675),(0,203553,203399,353114),[4,4,[],[(1123),(1124),(1129),(1135),(1136),(1819),(1122),(1126),(1128),(1820)],[(256,200),(278,200),(276,200),(275,200),(271,200)]],[(188847,265,(),(7578,8151,7899,1472,6646),()),(186787,265,(),(7578,7893,1524,6646),()),(172319,291,(),(7098,7882,8156,6649,6650,1588),()),(44693,1,(),(),()),(188849,265,(),(8153,7899,1472,6646),()),(186819,265,(),(8136,8137,7578,7896,1524,6646),()),(188848,265,(),(8155,7899,1472,6646),()),(186809,265,(),(8136,8137,7896,1524,6646),()),(186820,265,(),(8136,8138,7578,7893,1524,6646),()),(188853,265,(),(8154,7896,1472,6646),()),(178926,291,(),(8121,7882,8156,6649,6650,1588,6935),()),(186786,265,(),(7579,7893,1524,6646),()),(185304,233,(),(7305,1492,6646),()),(186868,262,(),(7534,1521,6646),()),(186782,265,(),(8136,8138,7893,1524,6646),()),(186865,275,(),(7548,6652,1534,6646),()),(0,0,(),(),()),(147336,37,(),(),())],[Player-1084-08A89569,768,Player-1084-08A89569,5225],327,33,767,1",
        startDate + "  SPELL_AURA_APPLIED,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,110310,\"Dampening\",0x1,DEBUFF",
        // 'SPELL_PERIODIC_HEAL' isn't currently an event of interest so we want to test that too
        startDate + '  SPELL_PERIODIC_HEAL,Player-1084-08A89569,"Alexsmite-TarrenMill",0x10512,0x0,Player-1084-08A89569,"Alexsmite-TarrenMill",0x10512,0x0,199483,"Camouflage",0x1,Player-1084-08A89569,0000000000000000,86420,86420,2823,369,1254,0,2,100,100,0,284.69,287.62,0,2.9138,285,2291,2291,2291,0,nil',
    ].forEach(v => combatLogParser.handleLogLine('retail', v));

    const testArenaStopLine = endDate + "  ARENA_MATCH_END,0,8,1673,1668";

    if (!endTest) {
        return;
    }

    setTimeout(() => {
        combatLogParser.handleLogLine('retail', testArenaStopLine);
        testRunning = false;
    }, 10 * 1000);
}

export {
    watchLogs,
    pollWowProcess,
    runRecordingTest,
    Metadata,
    forceStopRecording,
};
