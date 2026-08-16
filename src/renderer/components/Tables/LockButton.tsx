import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { LockKeyhole, LockOpen } from 'lucide-react';
import { RendererVideo, CloudStatus } from 'main/types';
import { stopPropagation } from 'renderer/rendererutils';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import { Dispatch, SetStateAction } from 'react';

const ipc = window.electron.ipcRenderer;

const setLock = (
  videos: Array<RendererVideo>,
  lock: boolean,
  setVideoState: Dispatch<SetStateAction<Array<RendererVideo>>>,
) => {
  const disk = videos.filter((v) => !v.cloud);
  const cloud = videos.filter((v) => v.cloud);

  ipc.sendMessage('videoButtonDisk', ['protect', lock, disk]);
  ipc.sendMessage('videoButtonCloud', ['protect', lock, cloud]);

  setVideoState((prev) => {
    return prev.map((rv) => {
      return videos.some((v) => v.uniqueId === rv.uniqueId)
        ? { ...rv, isProtected: lock }
        : rv;
    });
  });
};

type LockButtonProps = {
  language: Language;
  cloudStatus: CloudStatus;
  setVideoState: Dispatch<SetStateAction<Array<RendererVideo>>>;
  parent: RendererVideo;
};

const LockButton = (props: LockButtonProps) => {
  const { language, cloudStatus, setVideoState, parent } = props;

  const { write, del } = cloudStatus;
  const { isProtected } = parent;

  const noPermission =
    (!write && parent.cloud) || (!del && parent.cloud && isProtected);

  const icon = isProtected ? <LockKeyhole size={18} /> : <LockOpen size={18} />;

  let tooltip = '';

  if (noPermission) {
    tooltip = getLocalePhrase(language, Phrase.GuildNoPermission);
  } else if (!isProtected) {
    tooltip = getLocalePhrase(language, Phrase.StarSelected);
  } else {
    tooltip = getLocalePhrase(language, Phrase.UnstarSelected);
  }

  return (
    <Tooltip content={tooltip}>
      <div className="flex justify-center items-center">
        <Button
          variant="ghost"
          size="xs"
          onClick={(event) => {
            stopPropagation(event);
            setLock([parent], !isProtected, setVideoState);
          }}
          disabled={noPermission}
        >
          {icon}
        </Button>
      </div>
    </Tooltip>
  );
};

export default LockButton;
