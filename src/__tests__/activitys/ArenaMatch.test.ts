import ArenaMatch from '../../activitys/ArenaMatch';
import { Flavour } from '../../main/types';
import { VideoCategory } from '../../types/VideoCategory';
import Combatant from '../../main/Combatant';

test('Basic Arena Match', () => {
  const startDate = new Date('2022-12-25T12:00:00');

  const testCombatants = [
    new Combatant('Player-1329-09C34603', 0, 253),
    new Combatant('Player-1084-08A89569', 0, 256),
    new Combatant('Player-1092-0A70E103', 1, 557),
    new Combatant('Player-5810-0A3E1BD5', 1, 105),
  ];

  const arenaMatch = new ArenaMatch(
    startDate,
    VideoCategory.TwoVTwo,
    1672,
    Flavour.Retail
  );

  arenaMatch.playerGUID = testCombatants[0].GUID;

  for (let i = 0; i < testCombatants.length; i++) {
    arenaMatch.addCombatant(testCombatants[i]);
  }

  const winningTeamID = 0;
  const endDate = new Date('2022-12-25T12:05:00');
  arenaMatch.endArena(endDate, winningTeamID);

  const expectedDuration = (endDate.getTime() - startDate.getTime()) / 1000;
  const expectedResult = winningTeamID === testCombatants[0].teamID;

  expect(arenaMatch.duration).toBe(expectedDuration);
  expect(arenaMatch.result).toBe(expectedResult);
  expect(arenaMatch.resultInfo).toBe('Win');
  expect(arenaMatch.zoneName).toBe("Blade's Edge");

  expect(arenaMatch.getFileName()).toBe(
    "2022-12-25 12-00-00 - 2v2 Blade's Edge (Win)"
  );
});
