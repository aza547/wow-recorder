import React from 'react';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import { IconButton, Tooltip } from '@mui/material';

const ipc = window.electron.ipcRenderer;

export default function VersionUpdateWidget() {
  const [downloadUrl, setDownloadUrl] = React.useState<string>('');

  const openReleaseDownloadUrl = () => {
    ipc.sendMessage('openURL', [downloadUrl]);
  };

  React.useEffect(() => {
    ipc.on('updateAvailable', (url) => {
      setDownloadUrl(url as string);
    });
  }, []);

  if (!downloadUrl) {
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
