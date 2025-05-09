import { Row } from '@tanstack/react-table';
import { Language } from 'localisation/types';
import { RendererVideo } from 'main/types';
import {
  countUniqueViewpoints,
  getVideoResultText,
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
  const resultA = countUniqueViewpoints(a.original);
  const resultB = countUniqueViewpoints(b.original);
  return resultA - resultB;
};
