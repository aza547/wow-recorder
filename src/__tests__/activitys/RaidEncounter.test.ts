import { specializationById } from '../../main/constants';
import RaidEncounter from '../../activitys/RaidEncounter';
import { Flavour } from '../../main/types';
import Combatant from '../../main/Combatant';
import { Phrase } from '../../localisation/types';
import TestConfigService from '../../utils/TestConfigService';

const cfg = new TestConfigService();

const getRandomSpecID = () => {
  const keys = Object.keys(specializationById);
  return parseInt(keys[Math.floor(Math.random() * keys.length)], 10);
};

const getCombatants = (n: number) => {
  const testCombatants: Combatant[] = [];

  for (let i = 0; i < n; i++) {
    const formattedNumber = n.toLocaleString('en-US', {
      minimumIntegerDigits: 2,
    });

    const GUID = `Player-0000-000000${formattedNumber}`;
    const combatant = new Combatant(GUID, 0, getRandomSpecID());
    testCombatants.push(combatant);
  }

  return testCombatants;
};

test('Basic Raid Encounter', () => {
  const startDate = new Date('2022-12-25T12:00:00');
  const raidEncounter = new RaidEncounter(
    startDate,
    2607,
    'Raszageth',
    16,
    Flavour.Retail,
    cfg
  );

  const testCombatants = getCombatants(20);

  testCombatants.forEach((c) => {
    raidEncounter.addCombatant(c);
  });

  const endDate = new Date('2022-12-25T12:10:00');
  raidEncounter.end(endDate, true);

  expect(raidEncounter.duration).toBe(600);
  expect(raidEncounter.getFileName()).toBe(
    'Vault of the Incarnates, Raszageth [M] (Kill)'
  );

  expect(raidEncounter.difficulty).toStrictEqual({
    difficultyID: 'mythic',
    difficulty: 'M',
    partyType: 'raid',
    phrase: Phrase.Mythic,
  });

  expect(raidEncounter.resultInfo).toBe('Kill');
  expect(raidEncounter.raid.name).toBe('Vault of the Incarnates');
  expect(raidEncounter.zoneID).toBe(14030);
  expect(raidEncounter.encounterName).toBe('Raszageth');
});
