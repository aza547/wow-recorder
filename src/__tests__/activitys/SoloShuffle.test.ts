import { PlayerDeathType } from 'main/types';
import SoloShuffle from '../../activitys/SoloShuffle';
import Combatant from '../../main/Combatant';

const getPlayerDeath = (deathDate: Date, rel: number, isFriendly: boolean) => {
  const playerDeath: PlayerDeathType = {
    name: 'Alexsmite',
    specId: 253,
    date: deathDate,
    timestamp: rel,
    friendly: isFriendly,
  };

  return playerDeath;
};

const getRelativeDate = (initialDate: Date, secs: number) => {
  return new Date(initialDate.getTime() + 1000 * secs);
};

test('Basic Solo Shuffle', () => {
  const startDate = new Date('2022-12-25T12:00:00');
  const endDate = getRelativeDate(startDate, 6 * 60);

  const roundStartDates = [
    getRelativeDate(startDate, 1 * 60),
    getRelativeDate(startDate, 2 * 60),
    getRelativeDate(startDate, 3 * 60),
    getRelativeDate(startDate, 4 * 60),
    getRelativeDate(startDate, 5 * 60),
  ];

  const testCombatants = [
    new Combatant('Player-1329-09C34603', 0, 253),
    new Combatant('Player-1084-08A89569', 0, 256),
    new Combatant('Player-1092-0A70E103', 0, 557),
    new Combatant('Player-5810-0A3E1BD5', 1, 105),
    new Combatant('Player-5810-0A3E1BD5', 1, 107),
    new Combatant('Player-5810-0A3E1BD5', 1, 104),
  ];

  const soloShuffle = new SoloShuffle(startDate, 1672);

  // First round
  let death = getPlayerDeath(getRelativeDate(startDate, 45), 45, false);

  for (let j = 0; j < testCombatants.length; j++) {
    soloShuffle.addCombatant(testCombatants[j]);
  }

  soloShuffle.playerGUID = testCombatants[0].GUID;
  soloShuffle.addDeath(death);

  // Subsequent rounds
  for (let i = 0; i < 5; i++) {
    soloShuffle.startRound(roundStartDates[i]);

    for (let j = 0; j < testCombatants.length; j++) {
      soloShuffle.addCombatant(testCombatants[j]);
    }

    soloShuffle.playerGUID = testCombatants[0].GUID;
    death = getPlayerDeath(getRelativeDate(startDate, 45 + i * 60), 45, true);
    soloShuffle.addDeath(death);
  }

  soloShuffle.endGame(endDate);

  const expectedDuration = (endDate.getTime() - startDate.getTime()) / 1000;
  const overrun = 3;

  expect(soloShuffle.duration).toBe(expectedDuration + overrun);
  expect(soloShuffle.getFileName()).toBe("Solo Shuffle Blade's Edge (1-5)");
  expect(soloShuffle.resultInfo).toBe('1-5');
  expect(soloShuffle.roundsWon).toBe(1);
  expect(soloShuffle.zoneName).toBe("Blade's Edge");
});
