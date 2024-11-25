import { Row } from '@tanstack/react-table';
import { RendererVideo } from 'main/types';
import { getVideoResultText } from 'renderer/rendererutils';

export const resultSort = (a: Row<RendererVideo>, b: Row<RendererVideo>) => {
  const resultA = getVideoResultText(a.original);
  const resultB = getVideoResultText(b.original);
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
