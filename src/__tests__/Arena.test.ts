import { CombatLogParser } from '../main/combatLogParser';
import RetailLogHandler from '../log_handling/RetailLogHandler';
import { Recorder, RecorderOptionsType } from "../main/recorder";
jest.mock('../main/recorder');

const opts: RecorderOptionsType =  {
    mainWindow: null,
    storageDir:           "",
    bufferStorageDir:     "",
    maxStorage:             50,
    monitorIndex:         1,
    audioInputDeviceId:   "",
    audioOutputDeviceId: "",
    minEncounterDuration: 15,
    obsBaseResolution:    "",
    obsOutputResolution: "",
    obsFPS:               5,
    obsKBitRate:          5,
    obsCaptureMode:       "",
    obsRecEncoder:        "",
  };

test('Test', () => {
    const parser = new CombatLogParser();
    const recorder = new Recorder(opts);
    RetailLogHandler.getInstance(recorder, parser);
    parser.handleLogLine("retail", "line");
})

