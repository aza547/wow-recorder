import { recorder }  from '../main/main';
import { VideoCategory }  from '../main/constants';
import { ChallengeModeDungeon } from './keystone';
import { CombatLogParser } from '../main/combatLogParser';
import { LogLine } from './LogLine';
import { getSortedFiles } from '../main/util';
import { RetailLogHandler } from './RetailLogHandler';

let testRunning: boolean = false;
let activeChallengeMode: ChallengeModeDungeon | undefined;
let currentActivity: VideoCategory | undefined;

/**
 * Parser and handler for WoW combat log files
 * If no data has been received for 'dataTimeout' milliseconds, an event
 * will be emitted ('DataTimeout') to be able to clean up whatever was going on.
 */
const combatLogParser = new CombatLogParser({
    dataTimeout: 2 * 60 * 1000,
    fileFinderFn: getSortedFiles,
});

/**
 * Create the log handler objects.
 */
const retailHandler = new RetailLogHandler(recorder);
const classicHandler = new RetailLogHandler(recorder);

/**
 * 
 */
const handleRetailLogLine = (line: LogLine) => {
    retailHandler.handleLine(line);
}

/**
 * 
 */
const handleClassicLogLine = (line: LogLine) => {
    classicHandler.handleLine(line);
}

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
    .on('wow', handleRetailLogLine)
    .on('wow', handleClassicLogLine)

/**
 * If we haven't received data in a while, we're probably AFK and should stop recording.
 */
combatLogParser.on('DataTimeout', (timeoutMs: number) => {
    console.log(`[CombatLogParser] Haven't received data for combatlog in ${timeoutMs / 1000} seconds.`)

    /**
     * End the current challenge mode dungeon and stop recording.
     * We'll keep the video.
     */
    if (activeChallengeMode || currentActivity === VideoCategory.Battlegrounds) {
        // forceStopRecording();
        return;
    }
});



const sendTestCombatLogLine = (line: string): void => {
    console.debug('[Logutils] Sending test combat log line to the Combat Log Parser', line);
    combatLogParser.handleLogLine('retail', line);
};

/**
 * Function to invoke if the user clicks the "run a test" button
 * in the GUI. Uses some sample log lines from 2v2.txt.
 */
const runRecordingTest = (endTest: boolean = true) => {
    console.log("[Logutils] User pressed the test button!");

    if (!endTest) {
        console.log("[Logutils] The test will NOT end on its own and needs to be stopped manually.")
    }

    if (testRunning) {
        console.info("[Logutils] Test already running, not starting test.");
        return;
    }

    if (wowProcessRunning === null) {
        console.info("[Logutils] WoW isn't running, not starting test.");
        return;
    }

    console.info("[Logutils] WoW is running, starting test.");
    testRunning = true;

    /**
     * Return a combatlog formatted timestamp representing the current date/time
     * adjusted acording to `seconds` (which can be negative).
     */
    const getAdjustedDate = (seconds: number = 0): string => {
        const now = new Date(new Date().getTime() + (seconds * 1000));
        return `${now.getMonth() + 1}/${now.getDate()} ${now.toLocaleTimeString('en-GB')}.000`
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
    ].forEach(sendTestCombatLogLine);

    const testArenaStopLine = endDate + "  ARENA_MATCH_END,0,8,1673,1668";

    if (!endTest) {
        return;
    }

    setTimeout(() => {
        sendTestCombatLogLine(testArenaStopLine);
        testRunning = false;
    }, 10 * 1000);
}

    /**
     * Watch the given directories for combat log changes.
     * TODO SHouldnt be here 
     */
    //  watchLogs = (logDirectories: string[]) => {
    //     logDirectories.forEach((logdir: string) => {
    //         combatLogParser.watchPath(logdir);
    //     })
    // }

