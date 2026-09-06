import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { LockKeyhole, LockOpen } from 'lucide-react';
import { RendererVideo, CloudStatus } from 'main/types';
import { stopPropagation } from 'renderer/rendererutils';
import useVideoActions from 'renderer/useVideoActions';
import CircularProgress from '@mui/material/CircularProgress';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import { Dispatch, SetStateAction } from 'react';

type LockButtonProps = {
  language: Language;
  cloudStatus: CloudStatus;
  setVideoState: Dispatch<SetStateAction<Array<RendererVideo>>>;
  video: RendererVideo;
};

const LockButton = (props: LockButtonProps) => {
  const { language, cloudStatus, setVideoState, video } = props;
  const { run, isPending } = useVideoActions(setVideoState, language);
  const pending = isPending([video]);

  const { write, del } = cloudStatus;
  const { isProtected } = video;

  const noPermission =
    (!write && video.cloud) || (!del && video.cloud && isProtected);

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
            run({ type: 'protect', value: !isProtected }, [video]);
          }}
          disabled={noPermission || pending}
        >
          {pending ? <CircularProgress color="inherit" size={18} /> : icon}
        </Button>
      </div>
    </Tooltip>
  );
};

export default LockButton;
