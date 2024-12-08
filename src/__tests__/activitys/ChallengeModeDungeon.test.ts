import { PlayerDeathType } from 'main/types';
import ChallengeModeDungeon from '../../activitys/ChallengeModeDungeon';
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

test('Basic Challenge Mode', () => {
  const startDate = new Date('2022-12-25T12:00:00');
  const endDate = getRelativeDate(startDate, 30 * 60);

  const testCombatants = [
    new Combatant('Player-1329-09C34603', 0, 253),
    new Combatant('Player-1084-08A89569', 0, 256),
    new Combatant('Player-1092-0A70E103', 0, 557),
    new Combatant('Player-5810-0A3E1BD5', 0, 105),
    new Combatant('Player-5810-0A3E1BD5', 0, 107),
  ];

  const dungeon = new ChallengeModeDungeon(
    startDate,
    1822,
    353,
    10,
    [159, 10, 152, 9] // Peril included
  );

  for (let i = 0; i < testCombatants.length; i++) {
    dungeon.addCombatant(testCombatants[i]);
  }

  dungeon.playerGUID = testCombatants[0].GUID;

  for (let j = 0; j < 5; j++) {
    const relative = (j + 1) * 60;

    const death = getPlayerDeath(
      getRelativeDate(startDate, relative),
      relative,
      false
    );

    dungeon.addDeath(death);
  }

  dungeon.endChallengeMode(endDate, 1825, true);

  const expectedDuration = (endDate.getTime() - startDate.getTime()) / 1000;

  expect(dungeon.duration).toBe(expectedDuration);
  expect(dungeon.deaths.length).toBe(5);
  expect(dungeon.CMDuration).toBe(1825); // 5 deaths so +25 secs to timer

  expect(dungeon.result).toBe(true);
  expect(dungeon.upgradeLevel).toBe(1);
});

test('Hard Depleted Challenge Mode', () => {
  const startDate = new Date('2022-12-25T12:00:00');
  const endDate = getRelativeDate(startDate, 60 * 60); // 60 mins - way over time

  const testCombatants = [
    new Combatant('Player-1329-09C34603', 0, 253),
    new Combatant('Player-1084-08A89569', 0, 256),
    new Combatant('Player-1092-0A70E103', 0, 557),
    new Combatant('Player-5810-0A3E1BD5', 0, 105),
    new Combatant('Player-5810-0A3E1BD5', 0, 107),
  ];

  const dungeon = new ChallengeModeDungeon(
    startDate,
    1822,
    353,
    10,
    [159, 10, 152, 9] // Peril included
  );

  for (let i = 0; i < testCombatants.length; i++) {
    dungeon.addCombatant(testCombatants[i]);
  }

  dungeon.playerGUID = testCombatants[0].GUID;

  for (let j = 0; j < 5; j++) {
    const relative = (j + 1) * 60;

    const death = getPlayerDeath(
      getRelativeDate(startDate, relative),
      relative,
      false
    );

    dungeon.addDeath(death);
  }

  dungeon.endChallengeMode(endDate, 3625, true);

  const expectedDuration = (endDate.getTime() - startDate.getTime()) / 1000;

  expect(dungeon.duration).toBe(expectedDuration);
  expect(dungeon.deaths.length).toBe(5);
  expect(dungeon.CMDuration).toBe(3625); // 5 deaths so +25 secs to timer

  expect(dungeon.result).toBe(true); // not depleted not abandoned
  expect(dungeon.upgradeLevel).toBe(0);
});

test('Peril Timed Challenge Mode', () => {
  const startDate = new Date('2022-12-25T12:00:00');
  const endDate = getRelativeDate(startDate, 34 * 60); // Over the base time of 33 mins

  const testCombatants = [
    new Combatant('Player-1329-09C34603', 0, 253),
    new Combatant('Player-1084-08A89569', 0, 256),
    new Combatant('Player-1092-0A70E103', 0, 557),
    new Combatant('Player-5810-0A3E1BD5', 0, 105),
    new Combatant('Player-5810-0A3E1BD5', 0, 107),
  ];

  const dungeon = new ChallengeModeDungeon(
    startDate,
    1822,
    353,
    10,
    [159, 10, 152, 9] // Peril included so we get +90 on the timer
  );

  for (let i = 0; i < testCombatants.length; i++) {
    dungeon.addCombatant(testCombatants[i]);
  }

  dungeon.playerGUID = testCombatants[0].GUID;

  dungeon.endChallengeMode(endDate, 34 * 60, true);

  const expectedDuration = (endDate.getTime() - startDate.getTime()) / 1000;

  expect(dungeon.duration).toBe(expectedDuration);
  expect(dungeon.deaths.length).toBe(0);
  expect(dungeon.CMDuration).toBe(34 * 60);

  expect(dungeon.result).toBe(true);
  expect(dungeon.upgradeLevel).toBe(1);
});

test('Peril Depleted Challenge Mode', () => {
  const startDate = new Date('2022-12-25T12:00:00');
  const endDate = getRelativeDate(startDate, 34 * 60); // Over the base time of 33 mins

  const testCombatants = [
    new Combatant('Player-1329-09C34603', 0, 253),
    new Combatant('Player-1084-08A89569', 0, 256),
    new Combatant('Player-1092-0A70E103', 0, 557),
    new Combatant('Player-5810-0A3E1BD5', 0, 105),
    new Combatant('Player-5810-0A3E1BD5', 0, 107),
  ];

  const dungeon = new ChallengeModeDungeon(
    startDate,
    1822,
    353,
    10,
    [159, 10, 152, 9] // Peril included so we get +90 on the timer
  );

  for (let i = 0; i < testCombatants.length; i++) {
    dungeon.addCombatant(testCombatants[i]);
  }

  dungeon.playerGUID = testCombatants[0].GUID;

  for (let j = 0; j < 3; j++) {
    // Add 3 deaths, so +45s on the timer.
    const relative = (j + 1) * 60;

    const death = getPlayerDeath(
      getRelativeDate(startDate, relative),
      relative,
      false
    );

    dungeon.addDeath(death);
  }

  dungeon.endChallengeMode(endDate, 34 * 60 + 10, true);

  const expectedDuration = (endDate.getTime() - startDate.getTime()) / 1000;

  expect(dungeon.duration).toBe(expectedDuration);
  expect(dungeon.deaths.length).toBe(3);
  expect(dungeon.CMDuration).toBe(34 * 60 + 10);

  expect(dungeon.result).toBe(true);
  expect(dungeon.upgradeLevel).toBe(0);
});
