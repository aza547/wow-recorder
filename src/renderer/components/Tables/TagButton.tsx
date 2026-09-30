import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { RendererVideo, CloudStatus, DialogType } from 'main/types';
import { stopPropagation } from 'renderer/rendererutils';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import { Dispatch, SetStateAction } from 'react';
import { MessageSquare, MessageSquareMore } from 'lucide-react';
import { FolderMessageSquareMore } from 'renderer/icons/FolderMessageSquareMore';
import { FolderMessageSquare } from 'renderer/icons/FolderMessageSquare';

type TagButtonProps = {
  language: Language;
  cloudStatus: CloudStatus;
  video: RendererVideo;
  setDialog: Dispatch<SetStateAction<DialogType>>;
  setTagDialogVideoTargetId: Dispatch<SetStateAction<string | null>>;
};

const TagButton = (props: TagButtonProps) => {
  const { video, language, cloudStatus, setTagDialogVideoTargetId, setDialog } =
    props;

  const group = [video, ...video.multiPov];
  const foundTag = group.map((v) => v.tag).find((t) => t);

  if (group.length > 1) {
    return (
      <Tooltip content={getLocalePhrase(language, Phrase.OpenTagDialog)}>
        <div>
          <Button
            variant="ghost"
            size="xs"
            onClick={(event) => {
              stopPropagation(event);
              setTagDialogVideoTargetId(video.uniqueId);
              setDialog(DialogType.TAG);
            }}
          >
            {foundTag ? (
              <FolderMessageSquareMore size={18} />
            ) : (
              <FolderMessageSquare size={18} />
            )}
          </Button>
        </div>
      </Tooltip>
    );
  }

  const noPermission = !cloudStatus.write && group.some((v) => v.cloud);
  let tag = '';
  let icon = <MessageSquare size={18} />;

  let tooltip = noPermission
    ? getLocalePhrase(language, Phrase.GuildNoPermission)
    : getLocalePhrase(language, Phrase.TagButtonTooltip);

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
      <div>
        <Button
          variant="ghost"
          size="xs"
          disabled={noPermission}
          onClick={(event) => {
            stopPropagation(event);
            setTagDialogVideoTargetId(video.uniqueId);
            setDialog(DialogType.TAG);
          }}
        >
          {icon}
        </Button>
      </div>
    </Tooltip>
  );
};

export default TagButton;
