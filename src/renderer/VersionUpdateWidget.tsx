import React from 'react';

const ipc = window.electron.ipcRenderer;

export default function VersionUpdateWidget() {
  const openReleaseDownloadUrl = () => {
    ipc.sendMessage('openURL', [downloadUrl]);
  };

  const [downloadUrl, setDownloadUrl] = React.useState<string>('');

  React.useEffect(() => {
    ipc.on('updateAvailable', (downloadUrl) => {
      setDownloadUrl(downloadUrl as string);
    });
  }, []);
  
  if(!downloadUrl) { return null; }

  return (
    <div className="version-update-widget">
      <div>
        <a href="#" onClick={openReleaseDownloadUrl}>
          New update available! Click here to download.
        </a>
      </div>
    </div>
  );
}
