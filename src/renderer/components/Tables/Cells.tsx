import { CellContext } from '@tanstack/react-table';
import { AppState, RendererVideo } from 'main/types';
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
import { affixImages, specImages } from 'renderer/images';
import { Language, Phrase } from 'localisation/types';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import { getLocalePhrase } from 'localisation/translations';
import {
  LockKeyhole,
  LockOpen,
  MessageSquare,
  MessageSquareMore,
} from 'lucide-react';
import { Dispatch, SetStateAction } from 'react';
import { dungeonAffixesById } from 'main/constants';
import TagDialog from 'renderer/TagDialog';

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
  return <div className="truncate">{dateToHumanReadable(date)}</div>;
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
  appState: AppState,
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>,
) => {
  const video = ctx.getValue() as RendererVideo;
  const { language, cloudStatus } = appState;
  const { write, del } = cloudStatus;

  const renderProtectedIcon = () => {
    // If any videos in our selection are not protected, then the button's
    // action is to protect.
    const toProtect = [video, ...video.multiPov];
    const lock = !toProtect.every((v) => v.isProtected);

    // Disable the protect button if there are no selected viewpoints, or if
    // the action is to unprotect and we don't have delete permissions.
    const noPermission = !del && !lock && toProtect.some((v) => v.cloud);
    const disabled = noPermission || toProtect.length < 1;

    const icon = lock ? <LockOpen size={20} /> : <LockKeyhole size={20} />;

    let tooltip = '';

    if (noPermission) {
      tooltip = getLocalePhrase(language, Phrase.GuildNoPermission);
    } else if (lock) {
      tooltip = getLocalePhrase(language, Phrase.StarSelected);
    } else {
      tooltip = getLocalePhrase(language, Phrase.UnstarSelected);
    }

    const toggleProtected = (e: React.MouseEvent<HTMLButtonElement>) => {
      stopPropagation(e);

      window.electron.ipcRenderer.sendMessage('videoButton', [
        'protect',
        lock,
        toProtect,
      ]);

      setVideoState((prev) => {
        const state = [...prev];

        state.forEach((rv) => {
          // A video is uniquely identified by its name and storage type.
          const match = toProtect.find(
            (v) => v.videoName === rv.videoName && v.cloud === rv.cloud,
          );

          if (match) {
            rv.isProtected = lock;
          }
        });

        return state;
      });
    };

    return (
      <Tooltip content={tooltip}>
        <div>
          <Button
            variant="ghost"
            size="xs"
            onClick={toggleProtected}
            disabled={disabled}
          >
            {icon}
          </Button>
        </div>
      </Tooltip>
    );
  };

  const renderTagIcon = () => {
    const toTag = [video, ...video.multiPov];
    const noPermission = !write && toTag.some((v) => v.cloud);

    let tag = '';
    let icon = <MessageSquare size={18} />;

    let tooltip = noPermission
      ? getLocalePhrase(language, Phrase.GuildNoPermission)
      : getLocalePhrase(language, Phrase.TagButtonTooltip);

    const foundTag = toTag.map((v) => v.tag).find((t) => t);

    if (foundTag) {
      tag = foundTag;
      icon = <MessageSquareMore size={18} />;

      if (tag.length > 50) {
        tooltip = `${tag.slice(0, 50)}...`;
      } else {
        tooltip = tag;
      }
    }

    return (
      <Tooltip content={tooltip}>
        <div onClick={(e) => e.stopPropagation()}>
          <TagDialog
            initialTag={tag}
            videos={toTag}
            setVideoState={setVideoState}
            appState={appState}
          >
            <Button variant="ghost" size="xs" disabled={noPermission}>
              {icon}
            </Button>
          </TagDialog>
        </div>
      </Tooltip>
    );
  };

  return (
    <Box className="inline-flex">
      {renderProtectedIcon()}
      {renderTagIcon()}
    </Box>
  );
};

export const populateLevelCell = (
  info: CellContext<RendererVideo, unknown>,
) => {
  const video = info.getValue() as RendererVideo;
  return `+${video.keystoneLevel || video.level}`;
};

export const populateAffixesCell = (
  info: CellContext<RendererVideo, unknown>,
) => {
  const video = info.getValue() as RendererVideo;

  const renderAffix = (id: number) => {
    const affixName = dungeonAffixesById[id];
    const affixImage = affixImages[id as keyof typeof affixImages];

    return (
      <Tooltip content={affixName} key={affixName}>
        <Box
          key={affixName}
          component="img"
          src={affixImage}
          sx={{
            height: '25px',
            width: '25px',
            border: '1px solid black',
            borderRadius: '15%',
            boxSizing: 'border-box',
            objectFit: 'cover',
          }}
        />
      </Tooltip>
    );
  };

  if (!video.affixes) {
    return <></>;
  }

  return (
    <div className="flex flex-row">{video.affixes.sort().map(renderAffix)}</div>
  );
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
    <div className="flex truncate">
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
