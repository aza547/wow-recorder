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
  isRaidUtil,
  isMythicPlusUtil,
  getDungeonName,
} from 'renderer/rendererutils';
import { Box, Checkbox } from '@mui/material';
import { specImages } from 'renderer/images';
import { Language, Phrase } from 'localisation/types';
import { Button } from '../Button/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAngleDoubleDown,
  faAngleDoubleUp,
  faMessage,
  faStar,
} from '@fortawesome/free-solid-svg-icons';
import {
  faStar as faStarOutline,
  faMessage as faMessageOutline,
} from '@fortawesome/free-regular-svg-icons';
import { Tooltip } from '../Tooltip/Tooltip';
import { getLocalePhrase } from 'localisation/translations';

export const populateResultCell = (
  info: CellContext<RendererVideo, unknown>,
  language: Language,
) => {
  const video = info.getValue() as RendererVideo;
  const resultText = getVideoResultText(video, language);
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
  info: CellContext<RendererVideo, unknown>,
) => {
  const rawValue = info.getValue() as RendererVideo;
  return getFormattedDuration(rawValue);
};

export const populateEncounterNameCell = (
  info: CellContext<RendererVideo, unknown>,
) => {
  const encounter = info.getValue() as string;
  return <div className="truncate">{encounter}</div>;
};

export const populateMapCell = (info: CellContext<RendererVideo, unknown>) => {
  const map = info.getValue() as string;
  return <div className="truncate">{map}</div>;
};

export const populateDateCell = (info: CellContext<RendererVideo, unknown>) => {
  const date = info.getValue() as Date;
  return dateToHumanReadable(date);
};

export const populateActivityCell = (
  info: CellContext<RendererVideo, unknown>,
  language: Language,
) => {
  const video = info.getValue() as RendererVideo;
  let activity = getLocalePhrase(language, Phrase.Unknown);

  if (isRaidUtil(video) && video.encounterName) {
    activity = video.encounterName;
  } else if (isMythicPlusUtil(video) && video.mapID) {
    activity = getDungeonName(video);
  } else if (video.zoneName) {
    activity = video.zoneName;
  }

  return <div className="truncate">{activity}</div>;
};

export const populateDetailsCell = (
  ctx: CellContext<RendererVideo, unknown>,
  language: Language,
) => {
  const { row } = ctx;
  const video = ctx.getValue() as RendererVideo;

  const renderExpandButton = () => {
    const tooltip = row.getIsExpanded()
      ? getLocalePhrase(language, Phrase.ClickToCollapse)
      : getLocalePhrase(language, Phrase.ClickToExpand);

    const icon = row.getIsExpanded() ? faAngleDoubleUp : faAngleDoubleDown;

    return (
      <Tooltip content={tooltip}>
        <Button
          className="cursor-pointer"
          size="sm"
          variant="ghost"
          onClick={(e) => {
            row.getToggleExpandedHandler()();
            stopPropagation(e);
          }}
        >
          <FontAwesomeIcon icon={icon} />
        </Button>
      </Tooltip>
    );
  };

  const renderTagIcon = () => {
    // Search for the tag in the video but also in any linked videos, we're
    // going to display either at the top of the table.
    const tags = [video, ...video.multiPov].map((v) => v.tag).filter((t) => t);

    const icon = tags.length > 0 ? faMessage : faMessageOutline;
    let tooltip = getLocalePhrase(language, Phrase.NoneTagged);

    if (tags.length > 1) {
      tooltip = getLocalePhrase(language, Phrase.MultipleTagged);
    } else if (tags.length > 0 && typeof tags[0] === 'string') {
      tooltip = tags[0];
    }

    return (
      <Tooltip content={tooltip}>
        <Box
          className="flex items-center text-card-foreground px-3"
          onClick={(e) => {
            stopPropagation(e);
          }}
        >
          <FontAwesomeIcon icon={icon} size="sm" />
        </Box>
      </Tooltip>
    );
  };

  const renderStarIcon = () => {
    const starred = [video, ...video.multiPov]
      .map((v) => v.protected)
      .find((p) => p);

    const icon = starred ? faStar : faStarOutline;
    const tooltip = starred
      ? getLocalePhrase(language, Phrase.SomeStarred)
      : getLocalePhrase(language, Phrase.NoneStarred);

    return (
      <Tooltip content={tooltip}>
        <Box
          className="flex items-center text-card-foreground pr-3"
          onClick={(e) => {
            stopPropagation(e);
          }}
        >
          <FontAwesomeIcon icon={icon} size="sm" />
        </Box>
      </Tooltip>
    );
  };

  return (
    <Box className="inline-flex">
      {renderStarIcon()}
      {renderTagIcon()}
      {renderExpandButton()}
    </Box>
  );
};

export const populateLevelCell = (
  info: CellContext<RendererVideo, unknown>,
) => {
  const video = info.getValue() as RendererVideo;
  return `+${video.keystoneLevel || video.level}`;
};

export const populateViewpointCell = (
  info: CellContext<RendererVideo, unknown>,
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

export const populateSelectCell = (
  ctx: CellContext<RendererVideo, unknown>,
) => {
  const { row } = ctx;
  return (
    <Checkbox
      checked={row.getIsSelected()}
      onClick={row.getToggleSelectedHandler()}
      onDoubleClick={stopPropagation}
      sx={{
        color: 'gray',
        '&.Mui-checked': {
          color: 'gray',
        },
        '&:hover': {
          backgroundColor: 'rgba(128, 128, 128, 0.05)',
        },
      }}
    />
  );
};
