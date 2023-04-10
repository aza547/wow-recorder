import { VideoCategory } from '../types/VideoCategory';
import CombatLogParser from '../parsing/CombatLogParser';
import Poller from './Poller';
import {
  testData2v2,
  testData3v3,
  testDataSoloShuffle,
  testDataRaid,
  testDataBattleground,
  testDataDungeon,
} from './testButtonData';

let testRunning = false;

const sendTestCombatLogLine = (parser: CombatLogParser, line: string): void => {
  console.debug(
    '[test] Sending test combat log line to the Combat Log Parser',
    line
  );

  parser.handleLogLine('retail', line);
};

/**
 * Return a combatlog formatted timestamp representing the current date/time
 * adjusted acording to `seconds` (which can be negative).
 */
const getAdjustedDate = (seconds = 0): string => {
  const now = new Date(new Date().getTime() + seconds * 1000);
  return `${now.getMonth() + 1}/${now.getDate()} ${now.toLocaleTimeString(
    'en-GB'
  )}.000`;
};

/**
 * Function to invoke if the user clicks the "run a test" button
 * in the GUI. Uses some sample log lines from 2v2.txt.
 */
export const runRetailRecordingTest = (
  category: VideoCategory,
  parser: CombatLogParser,
  endTest = true
) => {
  console.log('[test] User pressed the test button!');

  if (!endTest) {
    console.log(
      '[test] The test will NOT end on its own and needs to be stopped manually.'
    );
  }

  if (testRunning) {
    console.info('[test] Test already running, not starting test.');
    return;
  }

  if (!Poller.getInstance().isWowRunning) {
    console.info("[test] WoW isn't running, not starting test.");
    return;
  }

  console.info('[test] WoW is running, starting test.');
  testRunning = true;
  const startDate = getAdjustedDate();
  let testLines: string[];
  let testDuration = 5;

  // We need to use slice here or we end up with a reference and we lose a
  // line on each subsequent .pop() and click of the test button.
  if (category === VideoCategory.TwoVTwo) {
    testLines = testData2v2.slice();
  } else if (category === VideoCategory.ThreeVThree) {
    testLines = testData3v3.slice();
  } else if (category === VideoCategory.SoloShuffle) {
    testLines = testDataSoloShuffle.slice();
  } else if (category === VideoCategory.Raids) {
    // Run a longer test as the default is to throw away a raid encounter < 15s.
    testDuration = 20;
    testLines = testDataRaid.slice();
  } else if (category === VideoCategory.Battlegrounds) {
    testLines = testDataBattleground.slice();
  } else if (category === VideoCategory.MythicPlus) {
    testLines = testDataDungeon.slice();
  } else {
    testLines = [];
  }

  const endDate = getAdjustedDate(testDuration);
  const testArenaEndLine = `${endDate}  ${testLines[testLines.length - 1]}`;
  testLines.pop();

  testLines.forEach((line) => {
    const lineWithDate = `${startDate}  ${line}`;
    sendTestCombatLogLine(parser, lineWithDate);
  });

  if (!endTest) {
    return;
  }

  setTimeout(() => {
    sendTestCombatLogLine(parser, testArenaEndLine);
    testRunning = false;
  }, testDuration * 1000);
};

/**
 * Function to invoke if the user clicks the "run a test" button
 * in the GUI. Uses some sample log lines from 2v2.txt.
 */
export const runClassicRecordingTest = (
  parser: CombatLogParser,
  endTest = true
) => {
  console.log('[test] User pressed the test button!');

  if (!endTest) {
    console.log(
      '[test] The test will NOT end on its own and needs to be stopped manually.'
    );
  }

  if (testRunning) {
    console.info('[test] Test already running, not starting test.');
    return;
  }

  if (!Poller.getInstance().isWowRunning) {
    console.info("[test] WoW isn't running, not starting test.");
    return;
  }

  console.info('[test] WoW is running, starting test.');
  testRunning = true;

  // This inserts a test date so that the recorder doesn't confuse itself with
  // dates too far in the past. This happens when a recording doesn't end on its own
  // and we forcibly stop it using `new Date()` instead of the date from a log line
  // that ends an activity.
  const startDate = getAdjustedDate();
  const endDate = getAdjustedDate(10);

  const testLines = [
    `${startDate}  ZONE_CHANGE,562,"Blade's Edge Arena",0`,
    `${startDate}  SPELL_AURA_APPLIED,Player-4811-0381F1C0,"Sperge-Giantstalker",0x512,0x0,Player-4811-0381F1C0,"Sperge-Giantstalker",0x512,0x0,47436,"Battle Shout",0x1,BUFF`,
    `${startDate}  SPELL_AURA_APPLIED,Player-4811-036B0F06,"Alexpals-Giantstalker",0x511,0x0,Player-4811-0381F1C0,"Sperge-Giantstalker",0x10512,0x0,53563,"Beacon of Light",0x2,BUFF`,
    `${startDate}  SPELL_AURA_APPLIED,Player-4476-043F3626,"Jungledck-Gehennas",0x548,0x0,Player-4476-043F3626,"Jungledck-Gehennas",0x548,0x0,43308,"Find Fish",0x1,BUFF`,
    `${startDate}  SPELL_AURA_APPLIED,Player-4476-045C7252,"Notyourlock-Gehennas",0x548,0x0,Player-4476-045C7252,"Notyourlock-Gehennas",0x548,0x0,47893,"Fel Armor",0x20,BUFF`,
    `${startDate}  SPELL_CAST_SUCCESS,Player-4811-036B0F06,"Alexpals-Giantstalker",0x511,0x0,Player-4811-0381F1C0,"Sperge-Giantstalker",0x10512,0x0,48825,"Holy Shock",0x2,Player-4811-036B0F06,0000000000000000,100,100,1102,1538,19409,0,15978,18109,790,6243.86,265.41,0,2.3130,200`,
    `${startDate}  UNIT_DIED,0000000000000000,nil,0x80000000,0x80000000,Player-4476-043F3626,"Jungledck-Gehennas",0x548,0x0`,
  ];

  testLines.forEach((line) => sendTestCombatLogLine(parser, line));

  if (!endTest) {
    return;
  }

  const testArenaEndLine = `${endDate}  UNIT_DIED,0000000000000000,nil,0x80000000,0x80000000,Player-4476-045C7252,"Notyourlock-Gehennas",0x10548,0x0`;

  setTimeout(() => {
    sendTestCombatLogLine(parser, testArenaEndLine);
    testRunning = false;
  }, 5 * 1000);
};
