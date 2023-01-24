import { PlayerDeathType } from 'main/types';
import SoloShuffle from '../../activitys/SoloShuffle';
import Combatant from '../../main/Combatant';

const getPlayerDeath = (deathDate: Date, rel: number) => {
  const playerDeath: PlayerDeathType = {
    name: 'Alexsmite',
    specId: 253,
    date: deathDate,
    timestamp: rel,
    friendly: true,
  };

  return playerDeath;
};

// @@@ TODO lots of stuff here, it's still very rough and crap
test('Basic Solo SHuffle', () => {
  const startDate = new Date('2022-12-25T12:00:00');
  const endDate = new Date('2022-12-25T12:06:00');

  const roundStartDates = [
    new Date('2022-12-25T12:01:00'),
    new Date('2022-12-25T12:02:00'),
    new Date('2022-12-25T12:03:00'),
    new Date('2022-12-25T12:04:00'),
    new Date('2022-12-25T12:05:00'),
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

  // First round stuff
  let death = getPlayerDeath(new Date('2022-12-25T12:00:45'), 45);

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
    death = getPlayerDeath(new Date('2022-12-25T12:01:45'), 45);
    soloShuffle.addDeath(death);
  }

  soloShuffle.endGame(endDate);

  const expectedDuration = (endDate.getTime() - startDate.getTime()) / 1000;

  expect(soloShuffle.duration).toBe(expectedDuration);
});
