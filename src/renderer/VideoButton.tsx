import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import React, { MutableRefObject, useEffect, useState } from 'react';
import { RendererVideo, AppState } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import {
  CalendarDays,
  Clock,
  CloudDownload,
  CloudUpload,
  FolderOpen,
  Hourglass,
  Link2,
  PackageX,
  Trash,
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMessage, faStar } from '@fortawesome/free-solid-svg-icons';
import {
  faStar as faStarOutline,
  faMessage as faMessageOutline,
} from '@fortawesome/free-regular-svg-icons';
import {
  getResultColor,
  isArenaUtil,
  isBattlegroundUtil,
  isMythicPlusUtil,
  isRaidUtil,
  getFormattedDuration,
  getVideoTime,
  getVideoDate,
  stopPropagation,
  povNameSort,
  countUniquePovs,
} from './rendererutils';
import ArenaCompDisplay from './ArenaCompDisplay';
import DungeonCompDisplay from './DungeonCompDisplay';
import RaidEncounterInfo from './RaidEncounterInfo';
import BattlegroundInfo from './BattlegroundInfo';
import DungeonInfo from './DungeonInfo';
import ArenaInfo from './ArenaInfo';
import RaidCompAndResult from './RaidCompAndResult';
import TagDialog from './TagDialog';
import ControlIcon from '../../assets/icon/ctrl-icon.png';
import PovSelection from './PovSelection';
import { useSettings } from './useSettings';
import SnackBar from './SnackBar';
import StateManager from './StateManager';
import { cn } from './components/utils';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Button } from './components/Button/Button';

interface IProps {
  selected: boolean;
  video: RendererVideo;
  stateManager: MutableRefObject<StateManager>;
  videoState: RendererVideo[];
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
}

const ipc = window.electron.ipcRenderer;

export default function VideoButton(props: IProps) {
  const {
    selected,
    video,
    stateManager,
    videoState,
    setAppState,
    persistentProgress,
  } = props;
  const [config] = useSettings();
  const formattedDuration = getFormattedDuration(video);
  const isMythicPlus = isMythicPlusUtil(video);
  const isRaid = isRaidUtil(video);
  const isBattleground = isBattlegroundUtil(video);
  const isArena = isArenaUtil(video);
  const resultColor = getResultColor(video);
  const videoTime = getVideoTime(video);
  const videoDate = getVideoDate(video);

  const [ctrlDown, setCtrlDown] = useState<boolean>(false);
  const [tagDialogOpen, setTagDialogOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [localPovIndex, setLocalPovIndex] = useState<number>(0);

  const [linkSnackBarSuccessOpen, setLinkSnackBarSuccessOpen] = useState(false);
  const [linkSnackBarFailedOpen, setLinkSnackBarFailedOpen] = useState(false);

  const povs = [video, ...video.multiPov].sort(povNameSort);
  const multiPov = povs.length > 1;

  const pov = povs[localPovIndex];
  const { videoName, cloud, thumbnailSource, isProtected, tag, videoSource } =
    pov;

  // Check if we have this point of view duplicated in the other storage
  // type. Don't want to be showing the download button if we have already
  // got it on disk and vice versa.
  const haveOnDisk =
    !cloud ||
    povs.filter((v) => v.videoName === videoName).filter((v) => !v.cloud)
      .length > 0;

  const haveInCloud =
    cloud ||
    povs.filter((v) => v.videoName === videoName).filter((v) => v.cloud)
      .length > 0;

  let tagTooltip: string = tag || 'Add a tag';

  if (tagTooltip.length > 50) {
    tagTooltip = `${tagTooltip.slice(0, 50)}...`;
  }

  // We do some hokey maths here to decide the height of the button, because
  // I've no idea how else to stop the image resizing the entire thing unless
  // its parent has an absolute size, super annoying.
  const uniquePovs = countUniquePovs(povs);
  const buttonHeight = Math.max(25 + uniquePovs * 25, 130);

  useEffect(() => {
    if (povs.length > localPovIndex) {
      return;
    }

    setLocalPovIndex(0);
  }, [localPovIndex, povs.length, selected]);

  /**
   * Delete a video.
   */
  const deleteVideo = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setDeleteDialogOpen(false);

    const src = cloud ? videoName : videoSource;
    window.electron.ipcRenderer.sendMessage('deleteVideo', [src, cloud]);
    stateManager.current.deleteVideo(pov);

    if (!selected) {
      return;
    }

    setLocalPovIndex(0);
    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        selectedVideoName: undefined,
        playingVideo: undefined,
      };
    });
  };

  /**
   * Delete all the points of view for this video.
   */
  const deleteAllPovs = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setDeleteDialogOpen(false);

    povs.forEach((p) => {
      const src = p.cloud ? p.videoName : p.videoSource;

      window.electron.ipcRenderer.sendMessage('deleteVideo', [src, p.cloud]);

      stateManager.current.deleteVideo(p);
    });

    if (!selected) {
      return;
    }

    setLocalPovIndex(0);

    setAppState((prevState) => {
      return {
        ...prevState,
        selectedVideoName: undefined,
        playingVideo: undefined,
      };
    });
  };

  /**
   * Sets up event listeners so that users can skip the "Are you sure you want
   * to delete this video?" prompt by holding CTRL.
   */
  useEffect(() => {
    document.addEventListener('keyup', (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setCtrlDown(false);
      }
    });

    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setCtrlDown(true);
      }
    });
  });

  const openTagDialog = () => {
    setTagDialogOpen(true);
  };

  const protectVideo = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    stateManager.current.toggleProtect(pov);
    const src = cloud ? videoName : videoSource;
    const bool = !isProtected;

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'save',
      src,
      cloud,
      bool,
    ]);
  };

  const openLocation = (event: React.SyntheticEvent) => {
    event.stopPropagation();

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'open',
      videoSource,
      cloud,
    ]);
  };

  const deleteSingleClicked = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    if (ctrlDown) {
      deleteVideo(event);
    } else {
      setDeleteDialogOpen(true);
    }
  };

  const deleteAllClicked = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    if (ctrlDown) {
      deleteAllPovs(event);
    } else {
      setDeleteDialogOpen(true);
    }
  };

  const getTagDialog = () => {
    return (
      <TagDialog
        video={pov}
        tagDialogOpen={tagDialogOpen}
        setTagDialogOpen={setTagDialogOpen}
        stateManager={stateManager}
      />
    );
  };

  const getDeleteDialog = () => {
    const getTitle = () => {
      const msg = 'Are you sure?';
      return <DialogTitle sx={{ color: 'white' }}>{msg}</DialogTitle>;
    };

    const getHotKeyText = () => {
      return (
        <DialogContent sx={{ py: '4px' }}>
          <DialogContentText sx={{ color: 'white' }}>
            Hold{' '}
            <img
              src={ControlIcon}
              alt="Control Key"
              width="35"
              height="35"
              style={{ verticalAlign: 'middle' }}
            />{' '}
            to skip this prompt.
          </DialogContentText>
        </DialogContent>
      );
    };

    const getCancelButton = () => {
      return (
        <Button
          onClick={(event) => {
            event.stopPropagation();
            setDeleteDialogOpen(false);
          }}
          // sx={dialogButtonSx}
        >
          Cancel
        </Button>
      );
    };

    const getDeleteButton = () => {
      return (
        <Button
          onClick={(event) => {
            event.stopPropagation();
            deleteVideo(event);
          }}
          // sx={dialogButtonSx}
        >
          Delete
        </Button>
      );
    };

    return (
      <Dialog
        open={deleteDialogOpen}
        PaperProps={{ style: { backgroundColor: '#1A233A' } }}
      >
        {getTitle()}
        {getHotKeyText()}
        <DialogActions>
          {getCancelButton()}
          {getDeleteButton()}
        </DialogActions>
      </Dialog>
    );
  };

  const getOpenButton = () => {
    return (
      <Tooltip content="Open location">
        <Button
          onMouseDown={stopPropagation}
          onClick={openLocation}
          variant="secondary"
          size="icon"
        >
          <FolderOpen />
        </Button>
      </Tooltip>
    );
  };

  const uploadVideo = async () => {
    ipc.sendMessage('videoButton', ['upload', videoSource]);
  };

  const getUploadButton = () => {
    return (
      <Tooltip content="Upload to cloud">
        <Button
          onMouseDown={stopPropagation}
          onClick={uploadVideo}
          variant="secondary"
          size="icon"
        >
          <CloudUpload />
        </Button>
      </Tooltip>
    );
  };

  const downloadVideo = async () => {
    ipc.sendMessage('videoButton', ['download', pov]);
  };

  const getDownloadButton = () => {
    return (
      <Tooltip content="Download to disk">
        <Button
          onMouseDown={stopPropagation}
          onClick={downloadVideo}
          variant="secondary"
          size="icon"
        >
          <CloudDownload />
        </Button>
      </Tooltip>
    );
  };

  const getShareableLinkSnackBarSuccess = () => {
    return (
      <SnackBar
        message="Link copied, valid for up to 30 days."
        timeout={2}
        open={linkSnackBarSuccessOpen}
        setOpen={setLinkSnackBarSuccessOpen}
        color="#bb4420"
      />
    );
  };

  const getShareableLinkSnackBarFailed = () => {
    return (
      <SnackBar
        message="Failed to generate link, see logs."
        timeout={2}
        open={linkSnackBarFailedOpen}
        setOpen={setLinkSnackBarFailedOpen}
        color="#ff0033"
      />
    );
  };

  const getShareableLink = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    try {
      await ipc.invoke('getShareableLink', [videoName]);
      setLinkSnackBarSuccessOpen(true);
    } catch (error) {
      setLinkSnackBarFailedOpen(true);
    }
  };

  const getShareLinkButton = () => {
    return (
      <Tooltip content="Get shareable link">
        <div>
          {getShareableLinkSnackBarSuccess()}
          {getShareableLinkSnackBarFailed()}
          <Button
            onMouseDown={stopPropagation}
            onClick={getShareableLink}
            variant="secondary"
            size="icon"
          >
            <Link2 />
          </Button>
        </div>
      </Tooltip>
    );
  };

  const getDeleteSingleButton = () => {
    return (
      <Tooltip content="Delete">
        <Button
          onMouseDown={stopPropagation}
          onClick={deleteSingleClicked}
          variant="secondary"
          size="icon"
        >
          <Trash />
        </Button>
      </Tooltip>
    );
  };

  const getDeleteAllButton = () => {
    return (
      <Tooltip content="Delete all points of view">
        <Button
          onMouseDown={stopPropagation}
          onClick={deleteAllClicked}
          variant="secondary"
          size="icon"
        >
          <PackageX />
        </Button>
      </Tooltip>
    );
  };

  return (
    <div className="flex w-full">
      {getTagDialog()}
      {getDeleteDialog()}

      <div
        className={cn(
          'flex items-center content-evenly box-border w-full rounded-md border bg-video border-video-border hover:bg-video-hover transition-all relative',
          { 'bg-video-hover': selected }
        )}
        style={{ height: buttonHeight }}
      >
        <div
          className="h-full w-4 absolute top-0 right-0 rounded-r-md"
          style={{ backgroundColor: resultColor }}
        />
        <div className="flex items-center justify-center overflow-hidden w-80 h-full rounded-l-md">
          <img
            className="min-w-full min-h-full shrink-0"
            src={thumbnailSource}
            alt="video-thumbnail"
          />
        </div>

        <div className="h-full w-1/3 flex items-center content-center">
          <PovSelection
            povs={povs}
            parentButtonSelected={selected}
            localPovIndex={localPovIndex}
            setLocalPovIndex={setLocalPovIndex}
            setAppState={setAppState}
            persistentProgress={persistentProgress}
          />
        </div>

        <Box
          sx={{
            height: '100%',
            width: '25%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ m: 2 }}>
            {isArena && <ArenaInfo video={video} />}
            {isMythicPlus && <DungeonInfo video={video} />}
            {isRaid && <RaidEncounterInfo video={video} />}
            {isBattleground && <BattlegroundInfo video={video} />}
          </Box>
        </Box>

        <Box
          sx={{
            height: '100%',
            width: '25%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ m: 2 }}>
            {isArena && <ArenaCompDisplay video={video} />}
            {isMythicPlus && <DungeonCompDisplay video={video} />}
            {isRaid && (
              <RaidCompAndResult
                video={video}
                raidCategoryState={videoState.filter(
                  (v) => v.category === VideoCategory.Raids
                )}
              />
            )}
          </Box>
        </Box>

        <Box
          sx={{
            height: '100%',
            width: '35%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-evenly',
            flexDirection: 'column',
          }}
        >
          <div className="flex items-center content-center flex-row gap-x-4">
            <Tooltip content="Duration">
              <div className="flex flex-col items-center text-secondary-foreground gap-y-1">
                <Hourglass />
                <span className="font-semibold font-sans text-shadow-instance text-sm">
                  {formattedDuration}
                </span>
              </div>
            </Tooltip>

            <Tooltip content="Time">
              <div className="flex flex-col items-center text-secondary-foreground gap-y-1">
                <Clock />
                <span className="font-semibold font-sans text-shadow-instance text-sm">
                  {videoTime}
                </span>
              </div>
            </Tooltip>

            <Tooltip content="Date">
              <div className="flex flex-col items-center text-secondary-foreground gap-y-1">
                <CalendarDays />
                <span className="font-semibold font-sans text-shadow-instance text-sm">
                  {videoDate}
                </span>
              </div>
            </Tooltip>
          </div>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              mx: 1,
            }}
          >
            <div className="flex flex-row items-center content-center gap-x-2">
              <Tooltip content={tagTooltip}>
                <Button
                  onMouseDown={stopPropagation}
                  onClick={openTagDialog}
                  variant="secondary"
                  size="icon"
                >
                  {tag ? (
                    <FontAwesomeIcon icon={faMessage} size="lg" />
                  ) : (
                    <FontAwesomeIcon icon={faMessageOutline} size="lg" />
                  )}
                </Button>
              </Tooltip>

              <Tooltip content={isProtected ? 'Age out' : 'Never age out'}>
                <Button
                  onMouseDown={stopPropagation}
                  onClick={protectVideo}
                  variant="secondary"
                  size="icon"
                >
                  {isProtected ? (
                    <FontAwesomeIcon icon={faStar} size="lg" />
                  ) : (
                    <FontAwesomeIcon icon={faStarOutline} size="lg" />
                  )}
                </Button>
              </Tooltip>

              {cloud && getShareLinkButton()}
              {!cloud && getOpenButton()}
              {cloud && !haveOnDisk && getDownloadButton()}
              {!cloud &&
                !haveInCloud &&
                config.cloudUpload &&
                getUploadButton()}
              {getDeleteSingleButton()}
              {multiPov && getDeleteAllButton()}
            </div>
          </Box>
        </Box>
      </div>
    </div>
  );
}
