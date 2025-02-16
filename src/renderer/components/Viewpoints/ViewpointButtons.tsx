import { AppState, RendererVideo } from 'main/types';
import { MutableRefObject, useEffect, useState } from 'react';
import { FolderOpen, Link as Link1, Trash } from 'lucide-react';
import { faMessage, faStar } from '@fortawesome/free-solid-svg-icons';
import {
  faStar as faStarOutline,
  faMessage as faMessageOutline,
} from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { povDiskFirstNameSort, stopPropagation } from '../../rendererutils';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import { toast } from '../Toast/useToast';
import DeleteDialog from '../../DeleteDialog';
import StateManager from '../../StateManager';
import TagDialog from '../../TagDialog';

interface IProps {
  video: RendererVideo;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  stateManager: MutableRefObject<StateManager>;
}

const ipc = window.electron.ipcRenderer;

export default function ViewpointButtons(props: IProps) {
  const { appState, setAppState, persistentProgress, video, stateManager } =
    props;
  const povs = [video, ...video.multiPov].sort(povDiskFirstNameSort);
  const [ctrlDown, setCtrlDown] = useState<boolean>(false);

  /**
   * Sets up event listeners so that users can skip the "Are you sure you want
   * to delete this video?" prompt by holding CTRL.
   */
  useEffect(() => {
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') setCtrlDown(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') setCtrlDown(true);
    };

    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const { selectedVideos, multiPlayerMode } = appState;

  if (multiPlayerMode) {
    return <></>;
  }

  let videoToShow = povs.find(
    (p) => p.uniqueId === selectedVideos[0]?.uniqueId,
  );

  if (!videoToShow) {
    [videoToShow] = povs;
  }

  const { cloud, videoName, videoSource, isProtected } = videoToShow;

  const getTagButton = () => {
    const { tag } = videoToShow;

    let tagTooltip: string =
      tag || getLocalePhrase(appState.language, Phrase.TagButtonTooltip);

    if (tagTooltip.length > 50) {
      tagTooltip = `${tagTooltip.slice(0, 50)}...`;
    }

    return (
      <TagDialog
        video={videoToShow}
        stateManager={stateManager}
        tooltipContent={tagTooltip}
        appState={appState}
      >
        <Button onMouseDown={stopPropagation} variant="secondary" size="xl">
          {tag ? (
            <FontAwesomeIcon icon={faMessage} size="lg" />
          ) : (
            <FontAwesomeIcon icon={faMessageOutline} size="lg" />
          )}
        </Button>
      </TagDialog>
    );
  };

  const protectVideo = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    stateManager.current.toggleProtect(videoToShow);
    const src = cloud ? videoName : videoSource;
    const bool = !isProtected;

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'save',
      src,
      cloud,
      bool,
    ]);
  };

  const getProtectVideoButton = () => {
    return (
      <Tooltip
        content={
          isProtected
            ? getLocalePhrase(appState.language, Phrase.UnstarButtonTooltip)
            : getLocalePhrase(appState.language, Phrase.StarButtonTooltip)
        }
      >
        <Button
          onMouseDown={stopPropagation}
          onClick={protectVideo}
          variant="secondary"
          size="xl"
        >
          {isProtected ? (
            <FontAwesomeIcon icon={faStar} size="lg" />
          ) : (
            <FontAwesomeIcon icon={faStarOutline} size="lg" />
          )}
        </Button>
      </Tooltip>
    );
  };

  const getShareableLink = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    try {
      await ipc.invoke('getShareableLink', [videoName]);
      toast({
        title: getLocalePhrase(appState.language, Phrase.ShareableLinkTitle),
        description: getLocalePhrase(
          appState.language,
          Phrase.ShareableLinkText,
        ),
        duration: 5000,
      });
    } catch {
      toast({
        title: getLocalePhrase(
          appState.language,
          Phrase.ShareableLinkFailedTitle,
        ),
        description: getLocalePhrase(
          appState.language,
          Phrase.ShareableLinkFailedText,
        ),
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const getShareLinkButton = () => {
    return (
      <Tooltip
        content={getLocalePhrase(
          appState.language,
          Phrase.ShareLinkButtonTooltip,
        )}
      >
        <Button
          onMouseDown={stopPropagation}
          onClick={getShareableLink}
          variant="secondary"
          size="xl"
        >
          <Link1 />
        </Button>
      </Tooltip>
    );
  };

  const openLocation = (event: React.SyntheticEvent) => {
    event.stopPropagation();

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'open',
      videoSource,
      cloud,
    ]);
  };

  const getOpenButton = () => {
    return (
      <Tooltip
        content={getLocalePhrase(
          appState.language,
          Phrase.OpenFolderButtonTooltip,
        )}
      >
        <Button
          onMouseDown={stopPropagation}
          onClick={openLocation}
          variant="secondary"
          size="xl"
        >
          <FolderOpen />
        </Button>
      </Tooltip>
    );
  };

  const deleteVideo = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    const src = cloud ? videoName : videoSource;
    window.electron.ipcRenderer.sendMessage('deleteVideo', [src, cloud]);
    stateManager.current.deleteVideo(videoToShow);
    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        selectedVideos: [],
        playing: false,
      };
    });
  };

  const onDeleteSingle = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    if (ctrlDown) {
      deleteVideo(event);
    }
  };

  const getDeleteSingleButton = () => {
    return (
      <DeleteDialog
        onDelete={(e) => deleteVideo(e)}
        tooltipContent={getLocalePhrase(
          appState.language,
          Phrase.DeleteButtonTooltip,
        )}
        skipPossible
        appState={appState}
      >
        <Button
          onMouseDown={stopPropagation}
          variant="secondary"
          size="xl"
          onClick={onDeleteSingle}
        >
          <Trash />
        </Button>
      </DeleteDialog>
    );
  };

  return (
    <div className="flex flex-row items-center content-center gap-x-2 py-1 pr-10">
      {getTagButton()}
      {getProtectVideoButton()}
      {cloud && getShareLinkButton()}
      {!cloud && getOpenButton()}
      {getDeleteSingleButton()}
    </div>
  );
}
