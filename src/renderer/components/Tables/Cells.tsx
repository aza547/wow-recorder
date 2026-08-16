import { CellContext, stockFeatures } from '@tanstack/react-table';
import {
  CloudStatus,
  DialogType,
  RendererClip,
  RendererVideo,
} from 'main/types';
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
import { Box } from '@mui/material';
import { affixImages, specImages } from 'renderer/images';
import { Language, Phrase } from 'localisation/phrases';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import { getLocalePhrase } from 'localisation/translations';
import {
  Clapperboard,
  ExternalLink,
  LockKeyhole,
  LockOpen,
  MessageSquare,
  MessageSquareMore,
} from 'lucide-react';
import { Dispatch, SetStateAction } from 'react';
import { dungeonAffixesById } from 'main/constants';
import wcrIcon from '../../../../assets/icon/small-icon.png';
import LockButton from './LockButton';
import TagButton from './TagButton';
import MultiLockButton from './MultiLockButton';
import SaveIcon from '@mui/icons-material/Save';
import CloudIcon from '@mui/icons-material/Cloud';
import MultiTagButton from './MultiTagButton';

export const populateResultCell = (
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
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
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
) => {
  const rawValue = info.getValue() as RendererVideo;
  return getFormattedDuration(rawValue);
};

export const populateEncounterNameCell = (
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
) => {
  const encounter = info.getValue() as string;
  return <div className="truncate">{encounter}</div>;
};

export const populateMapCell = (
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
) => {
  const map = info.getValue() as string;
  return <div className="truncate">{map}</div>;
};

export const populateDateCell = (
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
) => {
  const date = info.getValue() as Date;
  return <div className="truncate">{dateToHumanReadable(date)}</div>;
};

export const populateActivityCell = (
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  language: Language,
) => {
  const video = info.getValue() as RendererVideo;
  let activity = getLocalePhrase(language, Phrase.Unknown);

  if (isRaidUtil(video) && video.encounterName) {
    activity = video.encounterName;
  } else if (isMythicPlusUtil(video) && video.mapID) {
    const dungeonName = getDungeonName(video);
    if (dungeonName) activity = dungeonName;
  } else if (video.zoneName) {
    activity = video.zoneName;
  }

  return <div className="truncate">{activity}</div>;
};

export const populateDetailsCell = (
  ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  language: Language,
  cloudStatus: CloudStatus,
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>,
  setDialog: Dispatch<SetStateAction<DialogType>>,
  setLockDialogVideoTargetId: Dispatch<SetStateAction<string | null>>,
  setTagDialogVideoTargetId: Dispatch<SetStateAction<string | null>>,
) => {
  const video = ctx.row.original;
  const group = [video, ...video.multiPov];

  return (
    <Box className="inline-flex">
      {group.length > 1 ? (
        <MultiLockButton
          language={language}
          parent={video}
          setDialog={setDialog}
          setLockDialogVideoTargetId={setLockDialogVideoTargetId}
        />
      ) : (
        <LockButton
          language={language}
          cloudStatus={cloudStatus}
          video={video}
          setVideoState={setVideoState}
        />
      )}

      {group.length > 1 ? (
        <MultiTagButton
          language={language}
          cloudStatus={cloudStatus}
          parent={video}
          setDialog={setDialog}
          setTagDialogVideoTargetId={setTagDialogVideoTargetId}
        />
      ) : (
        <TagButton
          language={language}
          cloudStatus={cloudStatus}
          video={video}
          setDialog={setDialog}
          setTagDialogVideoTargetId={setTagDialogVideoTargetId}
        />
      )}
    </Box>
  );
};

export const populateSourceCell = (
  ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  language: Language,
  getClipParent: (clip: RendererClip) => RendererVideo | undefined,
  goToClipParent: (clip: RendererClip) => void,
) => {
  const clip = ctx.getValue() as RendererClip;
  const parent = getClipParent(clip);
  const disabled = parent === undefined;

  const tooltip = disabled
    ? getLocalePhrase(language, Phrase.ClipSourceUnavailableTooltip)
    : getLocalePhrase(language, Phrase.ClipSourceTooltip);

  const goToSource = (e: React.MouseEvent<HTMLButtonElement>) => {
    stopPropagation(e);
    goToClipParent(clip);
  };

  return (
    <Box className="inline-flex">
      <Tooltip content={tooltip}>
        <div>
          <Button
            variant="ghost"
            size="xs"
            onClick={goToSource}
            disabled={disabled}
          >
            <ExternalLink size={18} />
          </Button>
        </div>
      </Tooltip>
    </Box>
  );
};

export const populateKillVideoCell = (
  ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  language: Language,
  setDialog: Dispatch<SetStateAction<DialogType>>,
  setKillVideoDialogVideoTargetId: Dispatch<SetStateAction<string | null>>,
) => {
  const video = ctx.getValue() as RendererVideo;
  const cloud = [video, ...video.multiPov].filter((rv) => rv.cloud);
  const disk = [video, ...video.multiPov].filter((rv) => !rv.cloud);
  const disabled = disk.length < 2;

  let tooltip = getLocalePhrase(language, Phrase.KillVideoCreatorTooltip);

  if (disabled && cloud.length + disk.length > 1) {
    tooltip = getLocalePhrase(
      language,
      Phrase.KillVideoCreatorTooltipNotEnoughLocal,
    );
  } else if (disabled) {
    tooltip = getLocalePhrase(
      language,
      Phrase.KillVideoCreatorTooltipNotEnoughPov,
    );
  }

  return (
    <Box className="inline-flex">
      <Tooltip content={tooltip}>
        <Button
          variant="ghost"
          size="xs"
          disabled={disabled}
          onClick={(event) => {
            stopPropagation(event);
            setKillVideoDialogVideoTargetId(video.uniqueId);
            setDialog(DialogType.KILL);
          }}
        >
          <Clapperboard size={18} />
        </Button>
      </Tooltip>
    </Box>
  );
};

export const populateLevelCell = (
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
) => {
  const video = info.getValue() as RendererVideo;
  return `+${video.keystoneLevel || video.level || 0}`;
};

export const populateAffixesCell = (
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
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
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
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

  const playerClass = getPlayerClass(first);
  const playerSpecID = getPlayerSpecID(first);
  let playerName = getPlayerName(first);
  let playerClassColor = getWoWClassColor(playerClass);
  let specIcon = specImages[playerSpecID as keyof typeof specImages];

  if (playerName === 'WCR Multipov Name') {
    playerName = 'Multiview';
    playerClassColor = '#bb4420';
    specIcon = wcrIcon;
  }

  const renderSpecAndName = () => {
    return (
      <>
        <Box
          key={player._GUID}
          component="img"
          src={specIcon}
          className="bg-background-higher"
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
          className="font-sans font-semibold text-md text-shadow-instance mx-1 truncate"
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

export const populateTagCell = (
  ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
) => {
  const { row } = ctx;
  const { tag } = row.original;

  const icon = tag ? (
    <MessageSquareMore size={18} />
  ) : (
    <MessageSquare size={18} />
  );

  return <div className="flex justify-center items-center">{icon}</div>;
};

export const populateStorageCell = (
  ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
) => {
  const { row } = ctx;
  const { cloud } = row.original;

  const icon = cloud ? (
    <CloudIcon
      sx={{
        height: '18px',
        width: '18px',
        color: 'white',
        opacity: 0.3,
        marginBottom: '3px',
      }}
    />
  ) : (
    <SaveIcon
      sx={{
        height: '18px',
        width: '18px',
        color: 'white',
        opacity: 0.3,
        marginBottom: '3px',
      }}
    />
  );

  return <div className="flex justify-center items-center">{icon}</div>;
};

export const populatePlayerCell = (
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  language: Language,
) => {
  const video = info.getValue() as RendererVideo;
  const { player } = video;

  if (!player || !player._specID) {
    return <div>{getLocalePhrase(language, Phrase.Unknown)}</div>;
  }

  const playerClass = getPlayerClass(video);
  const playerSpecID = getPlayerSpecID(video);
  const playerName = getPlayerName(video);
  const playerClassColor = getWoWClassColor(playerClass);
  const specIcon = specImages[playerSpecID as keyof typeof specImages];

  const renderSpecAndName = () => {
    return (
      <div className="flex items-center pl-2 min-w-0">
        <Box
          component="img"
          src={specIcon}
          className="bg-background-higher shrink-0"
          sx={{
            height: '25px',
            width: '25px',
            border: '1px solid black',
            borderRadius: '15%',
            boxSizing: 'border-box',
            objectFit: 'cover',
          }}
        />

        <div
          className="font-sans font-semibold text-sm text-shadow-instance mx-1 truncate min-w-0"
          style={{ color: playerClassColor }}
        >
          {playerName}
        </div>
      </div>
    );
  };

  return <div className="flex truncate">{renderSpecAndName()}</div>;
};

export const populateTagStatusCell = (
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  language: Language,
) => {
  const { row } = info;
  const { tag } = row.original;
  const text = tag ? tag : getLocalePhrase(language, Phrase.NoCustomTag);
  return <div className="truncate text-sm mx-2">{text}</div>;
};

export const populateLockCell = (
  ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
) => {
  const video = ctx.getValue() as RendererVideo;
  const { isProtected } = video;

  const icon = isProtected ? <LockKeyhole size={18} /> : <LockOpen size={18} />;

  return <div className="flex justify-center items-center">{icon}</div>;
};

export const populateLockedStatusCell = (
  info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  language: Language,
) => {
  const { row } = info;
  const { isProtected } = row.original;

  if (isProtected) {
    return (
      <div className="flex truncate text-sm">
        {getLocalePhrase(language, Phrase.SafeFromAutomaticDeletion)}
      </div>
    );
  }
  return (
    <div className="flex truncate text-sm">
      {getLocalePhrase(language, Phrase.EligibleForAutomaticDeletion)}
    </div>
  );
};
