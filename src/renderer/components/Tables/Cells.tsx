import { CellContext, Row } from '@tanstack/react-table';
import { RendererVideo } from 'main/types';
import {
  getVideoResultText,
  getResultColor,
  getFormattedDuration,
  dateToHumanReadable,
  getDungeonName,
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

export const populateDateCell = (info: CellContext<RendererVideo, unknown>) => {
  const date = info.getValue() as Date;
  return dateToHumanReadable(date);
};

export const populateDetailsCell = (
  row: Row<RendererVideo>,
  selectedRowId: string
) => {
  return (
    <Button
      onClick={row.getToggleExpandedHandler()}
      style={{ cursor: 'pointer' }}
      size="sm"
      variant="ghost"
    >
      {row.getIsExpanded() && selectedRowId === row.id ? (
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
