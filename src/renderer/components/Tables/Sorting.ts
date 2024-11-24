import { Row } from '@tanstack/react-table';
import { RendererVideo } from 'main/types';
import { getVideoResultText } from 'renderer/rendererutils';

export const difficultySort = (
  a: Row<RendererVideo>,
  b: Row<RendererVideo>
) => {
  const resultA = getVideoResultText(a.original);
  const resultB = getVideoResultText(b.original);
  return resultB.localeCompare(resultA);
};

export const durationSort = (a: Row<RendererVideo>, b: Row<RendererVideo>) => {
  const resultA = a.original.duration;
  const resultB = b.original.duration;
  return resultA - resultB;
};
