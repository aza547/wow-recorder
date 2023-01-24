import ArenaMatch from '../activitys/ArenaMatch';
import { Flavour } from '../main/types';
import { VideoCategory } from '../types/VideoCategory';
import Combatant from '../main/Combatant';

test('Basic Retail 2v2', () => {
  const testCombatants = [
    new Combatant('Player-1329-09C34603', 0, 253),
    new Combatant('Player-1084-08A89569', 0, 256),
    new Combatant('Player-1092-0A70E103', 1, 557),
    new Combatant('Player-5810-0A3E1BD5', 1, 105),
  ];

  const startDate = new Date('2022-12-25T12:00:00');

  const arenaMatch = new ArenaMatch(
    startDate,
    VideoCategory.TwoVTwo,
    1672,
    Flavour.Retail
  );

  arenaMatch.playerGUID = testCombatants[0].GUID;

  for (let i = 0; i < 4; i++) {
    arenaMatch.addCombatant(testCombatants[i]);
  }

  const endDate = new Date('2022-12-25T12:05:00');
  const winningTeamID = 0;
  arenaMatch.endArena(endDate, winningTeamID);

  const expectedDuration = (endDate.getTime() - startDate.getTime()) / 1000;
  const expectedResult = winningTeamID === testCombatants[0].teamID;

  expect(arenaMatch.duration).toBe(expectedDuration);
  expect(arenaMatch.result).toBe(expectedResult);
});
