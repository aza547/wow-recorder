import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { DialogType, RendererVideo } from 'main/types';
import { stopPropagation } from 'renderer/rendererutils';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import { FolderLocked } from 'renderer/icons/FolderLocked';
import { FolderUnlocked } from 'renderer/icons/FolderUnlocked';

type MultiLockButtonProps = {
  language: Language;
  parent: RendererVideo;
  setDialog: (dialog: DialogType) => void;
  setLockDialogVideoTargetId: (id: string | null) => void;
};

const MultiLockButton = (props: MultiLockButtonProps) => {
  const { language, parent, setDialog, setLockDialogVideoTargetId } = props;
  const tooltip = getLocalePhrase(language, Phrase.OpenLockDialog);

  const icon = [parent, ...parent.multiPov].some((rv) => rv.isProtected) ? (
    <FolderLocked size={20} />
  ) : (
    <FolderUnlocked size={20} />
  );

  return (
    <Tooltip content={tooltip}>
      <div>
        <Button
          variant="ghost"
          size="xs"
          onClick={(event) => {
            stopPropagation(event);
            setLockDialogVideoTargetId(parent.uniqueId);
            setDialog(DialogType.LOCK);
          }}
        >
          {icon}
        </Button>
      </div>
    </Tooltip>
  );
};

export default MultiLockButton;
