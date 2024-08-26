import { ArrowBigDownDash } from 'lucide-react';
import { UpgradeStatus } from 'main/types';
import React from 'react';
import { Button } from 'renderer/components/Button/Button';
import { Tooltip } from 'renderer/components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

type UpgradeNotifierProps = {
  upgradeStatus: UpgradeStatus;
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
  ({ upgradeStatus }: UpgradeNotifierProps) => {
    if (!upgradeStatus.available) return null;

    return (
      <Tooltip content="An update is available">
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
