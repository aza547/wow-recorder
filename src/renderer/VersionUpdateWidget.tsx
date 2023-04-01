import UpgradeIcon from '@mui/icons-material/Upgrade';
import { IconButton, Tooltip } from '@mui/material';
import { UpgradeStatus } from 'main/types';

const ipc = window.electron.ipcRenderer;

interface IProps {
  upgradeStatus: UpgradeStatus;
}

export default function VersionUpdateWidget(props: IProps) {
  const { upgradeStatus } = props;
  const { available, link } = upgradeStatus;

  const openReleaseDownloadUrl = () => {
    ipc.sendMessage('openURL', [link]);
  };

  if (!available) {
    return <></>;
  }

  return (
    <Tooltip title="Upgrade available, click to download">
      <IconButton
        id="test-button"
        type="button"
        onClick={openReleaseDownloadUrl}
        sx={{ padding: '2px', minWidth: '25px', color: 'white' }}
      >
        <UpgradeIcon sx={{ width: '25px', height: '25px' }} />
      </IconButton>
    </Tooltip>
  );
}
