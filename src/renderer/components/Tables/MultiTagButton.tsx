import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { RendererVideo, CloudStatus, DialogType } from 'main/types';
import { stopPropagation } from 'renderer/rendererutils';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import { Dispatch, SetStateAction } from 'react';
import { FolderMessageSquareMore } from 'renderer/icons/FolderMessageSquareMore';
import { FolderMessageSquare } from 'renderer/icons/FolderMessageSquare';

type MultiTagButtonProps = {
  language: Language;
  cloudStatus: CloudStatus;
  parent: RendererVideo;
  setDialog: Dispatch<SetStateAction<DialogType>>;
  setTagDialogVideoTargetId: Dispatch<SetStateAction<string | null>>;
};

const MultiTagButton = (props: MultiTagButtonProps) => {
  const { parent, language, setTagDialogVideoTargetId, setDialog } = props;
  const group = [parent, ...parent.multiPov];
  const foundTag = group.map((v) => v.tag).find((t) => t);

  return (
    <Tooltip content={getLocalePhrase(language, Phrase.OpenTagDialog)}>
      <div>
        <Button
          variant="ghost"
          size="xs"
          onClick={(event) => {
            stopPropagation(event);
            setTagDialogVideoTargetId(parent.uniqueId);
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
};

export default MultiTagButton;
