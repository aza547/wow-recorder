import React from 'react';
import icon from '../../assets/icon/update.png';

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
    return null;
  }

  return (
    <div id="version-update-widget">
      <button
        id="update-button"
        type="button"
        onClick={openReleaseDownloadUrl}
        title="New update available, click here to download!"
      >
        <img alt="icon" src={icon} height="25px" width="25px" />
      </button>
    </div>
  );
}
