import { CellContext, Row } from '@tanstack/react-table';
import { RendererVideo } from 'main/types';
import {
  getVideoResultText,
  getResultColor,
  getFormattedDuration,
  dateToHumanReadable,
  stopPropagation,
} from 'renderer/rendererutils';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import { Button } from '../Button/Button';

export const populateResultCell = (
  info: CellContext<RendererVideo, unknown>
) => {
  const video = info.getValue() as RendererVideo;
  const resultText = getVideoResultText(video);
  const resultColor = getResultColor(video);

  return (
    <span
      className="text-white font-sans font-semibold text-sm text-shadow-instance text-center"
      style={{ color: resultColor }}
    >
      {resultText}
    </span>
  );
};

export const populateDurationCell = (
  info: CellContext<RendererVideo, unknown>
) => {
  const rawValue = info.getValue() as RendererVideo;
  return getFormattedDuration(rawValue);
};

export const populateEncounterNameCell = (
  info: CellContext<RendererVideo, unknown>
) => {
  const encounter = info.getValue() as RendererVideo;
  return <div className="truncate">{encounter}</div>;
};

export const populateMapCell = (info: CellContext<RendererVideo, unknown>) => {
  const map = info.getValue() as RendererVideo;
  return <div className="truncate">{map}</div>;
};

export const populateDateCell = (info: CellContext<RendererVideo, unknown>) => {
  const date = info.getValue() as Date;
  return dateToHumanReadable(date);
};

export const populateTagCell = (info: CellContext<RendererVideo, unknown>) => {
  const tag = info.getValue() as RendererVideo;
  return <div className="truncate">{tag}</div>;
};

export const populateDetailsCell = (
  ctx: CellContext<RendererVideo, unknown>
) => {
  const { row } = ctx;

  return (
    <Button
      onClick={(e) => {
        row.getToggleExpandedHandler()();
        stopPropagation(e);
      }}
      className="cursor-pointer"
      size="sm"
      variant="ghost"
    >
      {row.getIsExpanded() ? (
        <KeyboardDoubleArrowUpIcon />
      ) : (
        <KeyboardDoubleArrowDownIcon />
      )}
    </Button>
  );
};

export const populateLevelCell = (
  info: CellContext<RendererVideo, unknown>
) => {
  const video = info.getValue() as RendererVideo;
  return `+${video.keystoneLevel || video.level}`;
};
