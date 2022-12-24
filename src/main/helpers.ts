/**
 * Please keep this file FREE from any filesystem/Node JS process related code as it
 * is used in both the backend and the frontend, and the frontend does not have
 * access to import 'fs', for example.
 *
 * It is okay to import things from other modules that import 'fs' as long as you don't
 * import a function that uses the 'fs' module. You'll very easily find out if what you
 * did was bad, because the render process will show its "Red Screen of Death".
 */
import {
  instanceDifficulty,
  instanceEncountersById,
  VideoCategory,
} from './constants';

/**
 * Get a result text appropriate for the video category that signifies a
 * win or a loss, of some sort. Must handle soloShuffle inputs being undefined.
 */
export const getVideoResultText = (
  category: VideoCategory,
  isGoodResult: boolean,
  soloShuffleRoundsWon: number,
  soloShuffleRoundsPlayed: number
): string => {
  switch (category) {
    case VideoCategory.MythicPlus:
      return isGoodResult ? 'Time' : 'Depl';

    case VideoCategory.Raids:
      return isGoodResult ? 'Kill' : 'Wipe';

    case VideoCategory.SoloShuffle:
      if (
        soloShuffleRoundsWon === undefined ||
        soloShuffleRoundsPlayed === undefined
      ) {
        // For backwards compatibility with versions 3.1.2 and below. Can
        // probably remove some day.
        return '';
      }
      {
        const wins = soloShuffleRoundsWon;
        const losses = soloShuffleRoundsPlayed - soloShuffleRoundsWon;
        return `${wins}-${losses}`;
      }

    default:
      return isGoodResult ? 'Win' : 'Loss';
  }
};

export const getVideoResultClass = (
  category: VideoCategory,
  isGoodResult: boolean,
  soloShuffleRoundsWon: number,
  soloShuffleRoundsPlayed: number
): string => {
  switch (category) {
    case VideoCategory.MythicPlus:
      return isGoodResult ? 'goodResult' : 'badResult';

    case VideoCategory.Raids:
      return isGoodResult ? 'goodResult' : 'badResult';

    case VideoCategory.SoloShuffle:
      if (
        soloShuffleRoundsWon === undefined ||
        soloShuffleRoundsPlayed === undefined
      ) {
        // For backwards compatibility with versions 3.1.2 and below. Can
        // probably remove some day.
        return '';
      }

      // For solo shuffle "isGoodResult" is irrelevant. We do maths
      // instead of just counting the wins here as we don't want to
      // assume the total number of rounds played.
      if (soloShuffleRoundsWon > 0.7 * soloShuffleRoundsPlayed) {
        return 'goodResult';
      }

      if (soloShuffleRoundsWon > 0.5 * soloShuffleRoundsPlayed) {
        return 'decentResult';
      }

      if (soloShuffleRoundsWon > 0.2 * soloShuffleRoundsPlayed) {
        return 'moderateResult';
      }

      if (soloShuffleRoundsWon > 0) {
        return 'mehResult';
      }

      return 'badResult';

    default:
      return isGoodResult ? 'goodResult' : 'badResult';
  }
};

export const getInstanceDifficulty = (id: number) => {
  const knownDifficulty = instanceDifficulty.hasOwnProperty(id);

  if (!knownDifficulty) {
    return null;
  }

  return instanceDifficulty[id];
};

/**
 * Get the name of a boss encounter based on its encounter ID. Ideally we
 * would just write this to the metadata and not have to re-calulate on the
 * frontend.
 */
export const getEncounterNameById = (encounterId: number): string => {
  if (instanceEncountersById.hasOwnProperty(encounterId)) {
    return instanceEncountersById[encounterId];
  }

  return 'Unknown Boss';
};
