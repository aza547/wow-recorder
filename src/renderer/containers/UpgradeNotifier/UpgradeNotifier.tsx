import { getLocalePhrase, Phrase } from 'localisation/translations';
import { ArrowBigDownDash } from 'lucide-react';
import { AppState, UpgradeStatus } from 'main/types';
import React from 'react';
import { Button } from 'renderer/components/Button/Button';
import { Tooltip } from 'renderer/components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

type UpgradeNotifierProps = {
  upgradeStatus: UpgradeStatus;
  appState: AppState;
};

function arePropsEqual(
  oldProps: UpgradeNotifierProps,
  newProps: UpgradeNotifierProps
): boolean {
  return (
    oldProps.upgradeStatus.available === newProps.upgradeStatus.available &&
    oldProps.upgradeStatus.link === newProps.upgradeStatus.link
  );
}

const UpgradeNotifier = React.memo(
  ({ upgradeStatus, appState }: UpgradeNotifierProps) => {
    if (!upgradeStatus.available) return null;

    return (
      <Tooltip
        content={getLocalePhrase(
          appState.language,
          Phrase.UpdateAvailableTooltip
        )}
      >
        <Button
          variant="ghost"
          type="button"
          size="icon"
          onClick={() => ipc.sendMessage('openURL', [upgradeStatus.link])}
        >
          <ArrowBigDownDash />
        </Button>
      </Tooltip>
    );
  },
  arePropsEqual
);

export default UpgradeNotifier;
