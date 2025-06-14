import { Row } from '@tanstack/react-table';
import { getLocalePhrase } from 'localisation/translations';
import { Language, Phrase } from 'localisation/types';
import { RendererVideo } from 'main/types';
import {
  countUniqueViewpoints,
  getDungeonName,
  getVideoResultText,
  isMythicPlusUtil,
  isRaidUtil,
  raidResultToPercent,
} from 'renderer/rendererutils';

export const resultSort = (
  a: Row<RendererVideo>,
  b: Row<RendererVideo>,
  language: Language,
) => {
  if (isRaidUtil(a.original) && isRaidUtil(b.original)) {
    const rA = raidResultToPercent(a.original) ?? 100;
    const rB = raidResultToPercent(b.original) ?? 100;
    return rB - rA;
  }

  const resultA = getVideoResultText(a.original, language);
  const resultB = getVideoResultText(b.original, language);

  if (isMythicPlusUtil(a.original) && isMythicPlusUtil(b.original)) {
    const depleted = getLocalePhrase(language, Phrase.Depleted);
    const abandoned = getLocalePhrase(language, Phrase.Abandoned);

    if (resultA === abandoned) {
      return 1;
    }

    if (resultB === abandoned) {
      return -1;
    }

    if (resultA === depleted) {
      return 1;
    }

    if (resultB === depleted) {
      return -1;
    }
  }

  return resultB.localeCompare(resultA);
};

export const levelSort = (a: Row<RendererVideo>, b: Row<RendererVideo>) => {
  const resultA = a.original.keystoneLevel || a.original.level || 0;
  const resultB = b.original.keystoneLevel || b.original.level || 0;
  return resultA - resultB;
};

export const durationSort = (a: Row<RendererVideo>, b: Row<RendererVideo>) => {
  const resultA = a.original.duration;
  const resultB = b.original.duration;
  return resultA - resultB;
};

export const viewPointCountSort = (
  a: Row<RendererVideo>,
  b: Row<RendererVideo>,
) => {
  const countA = countUniqueViewpoints(a.original);
  const countB = countUniqueViewpoints(b.original);

  if (countA !== countB) {
    return countA - countB;
  }

  const playerA = a.original.player?._name || '';
  const playerB = b.original.player?._name || '';
  return playerB.localeCompare(playerA);
};

export const detailSort = (a: Row<RendererVideo>, b: Row<RendererVideo>) => {
  const aProtected = a.original.isProtected;
  const bProtected = b.original.isProtected;

  const aTag = a.original.tag;
  const bTag = b.original.tag;

  if ((aProtected && !bProtected) || (aTag && !bTag)) {
    return 1;
  }

  if ((!aProtected && bProtected) || (!aTag && bTag)) {
    return -1;
  }

  return 0;
};

export const clipActivitySort = (
  a: Row<RendererVideo>,
  b: Row<RendererVideo>,
  language: Language,
) => {
  let activityA = getLocalePhrase(language, Phrase.Unknown);
  const rvA = a.original;

  if (isRaidUtil(rvA) && rvA.encounterName) {
    activityA = rvA.encounterName;
  } else if (isMythicPlusUtil(rvA) && rvA.mapID) {
    activityA = getDungeonName(rvA);
  } else if (rvA.zoneName) {
    activityA = rvA.zoneName;
  }

  let activityB = getLocalePhrase(language, Phrase.Unknown);
  const rvB = b.original;

  if (isRaidUtil(rvB) && rvB.encounterName) {
    activityB = rvB.encounterName;
  } else if (isMythicPlusUtil(rvB) && rvB.mapID) {
    activityB = getDungeonName(rvB);
  } else if (rvB.zoneName) {
    activityB = rvB.zoneName;
  }

  return activityB.localeCompare(activityA);
};
