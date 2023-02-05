import { Flavour, PlayerDeathType } from '../../main/types';
import Battleground from '../../activitys/Battleground';
import { VideoCategory } from '../../types/VideoCategory';

const getPlayerDeath = () => {
  const playerDeath: PlayerDeathType = {
    name: 'Alexsmite',
    specId: 253,
    date: new Date('2022-12-25T12:01:00'),
    timestamp: 60,
    friendly: false,
  };

  return playerDeath;
};

test('Basic Battleground', () => {
  const startDate = new Date('2022-12-25T12:00:00');

  const battleground = new Battleground(
    startDate,
    VideoCategory.Battlegrounds,
    761,
    Flavour.Retail
  );

  const death = getPlayerDeath();

  // Add an enemy death so we will estimate the BG is a win.
  battleground.addDeath(death);

  // We dont use the result in BGs so doesn't matter what it is.
  const endDate = new Date('2022-12-25T12:10:00');
  battleground.end(endDate, false);
  const expectedDuration = (endDate.getTime() - startDate.getTime()) / 1000;

  expect(battleground.duration).toBe(expectedDuration);
  expect(battleground.battlegroundName).toBe('The Battle for Gilneas');

  expect(battleground.getFileName()).toBe(
    '2022-12-25 12-00-00 - The Battle for Gilneas (Win)'
  );

  expect(battleground.estimateResult()).toBe(true);
});
