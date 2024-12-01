import { CellContext } from '@tanstack/react-table';
import { RendererVideo } from 'main/types';
import {
  getVideoResultText,
  getResultColor,
  getFormattedDuration,
  dateToHumanReadable,
  stopPropagation,
  countUniqueViewpoints,
  getPlayerClass,
  getPlayerName,
  getPlayerSpecID,
  getWoWClassColor,
  povDiskFirstNameSort,
} from 'renderer/rendererutils';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import { Box } from '@mui/material';
import { specImages } from 'renderer/images';
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

export const populateViewpointCell = (
  info: CellContext<RendererVideo, unknown>
) => {
  const video = info.getValue() as RendererVideo;
  const count = countUniqueViewpoints(video);

  // Prioritize the any videos with a disk copy as that's likely to be the
  // local users viewpoint so most relevant to them.
  const povs = [video, ...video.multiPov].sort(povDiskFirstNameSort);
  const first = povs[0];
  const { player } = first;

  if (!player || !player._specID) {
    // We don't have enough to render a spec icon and name so
    // just return the viewpoint count.
    return <div>{count}</div>;
  }

  const playerName = getPlayerName(first);
  const playerClass = getPlayerClass(first);
  const playerClassColor = getWoWClassColor(playerClass);
  const playerSpecID = getPlayerSpecID(first);
  const specIcon = specImages[playerSpecID as keyof typeof specImages];

  const renderSpecAndName = () => {
    return (
      <>
        <Box
          key={player._GUID}
          component="img"
          src={specIcon}
          sx={{
            display: 'flex',
            height: '25px',
            width: '25px',
            border: '1px solid black',
            borderRadius: '15%',
            boxSizing: 'border-box',
            objectFit: 'cover',
          }}
        />
        <div
          className="font-sans font-semibold text-md text-shadow-instance mx-1"
          style={{ color: playerClassColor }}
        >
          {playerName}
        </div>
      </>
    );
  };

  const renderRemainingCount = () => {
    if (count > 1) return <div>{`+${count - 1}`}</div>;
    return <></>;
  };

  return (
    <div className="flex ">
      {renderSpecAndName()}
      {renderRemainingCount()}
    </div>
  );
};
