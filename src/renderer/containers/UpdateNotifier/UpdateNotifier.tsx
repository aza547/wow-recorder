import { getLocalePhrase, Phrase } from 'localisation/translations';
import { ArrowBigUpDash } from 'lucide-react';
import { AppState } from 'main/types';
import React from 'react';
import { Button } from 'renderer/components/Button/Button';
import { Tooltip } from 'renderer/components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

type IProps = {
  updateAvailable: boolean;
  appState: AppState;
};

function arePropsEqual(oldProps: IProps, newProps: IProps): boolean {
  return oldProps.updateAvailable === newProps.updateAvailable;
}

const UpdateNotifier = React.memo(function UpdateNotifier({
  updateAvailable,
  appState,
}: IProps) {
  if (!updateAvailable) {
    return null;
  }

  return (
    <Tooltip
      content={getLocalePhrase(
        appState.language,
        Phrase.UpdateAvailableTooltip,
      )}
    >
      <Button
        variant="ghost"
        type="button"
        size="icon"
        onClick={() => ipc.sendMessage('doAppUpdate', [])}
      >
        <ArrowBigUpDash />
      </Button>
    </Tooltip>
  );
}, arePropsEqual);

export default UpdateNotifier;
