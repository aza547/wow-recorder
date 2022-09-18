import React from 'react';

const ipc = window.electron.ipcRenderer;

export default function VersionUpdateWidget() {

  const openReleaseDownloadUrl = () => {
    ipc.sendMessage('openURL', [downloadUrl]);
  };

  const [widgetClass, setWidgetClass] = React.useState("hidden");
  const [downloadUrl, setDownloadUrl] = React.useState<string>("");

  React.useEffect(() => {
    window.electron.ipcRenderer.on('updateAvailable', (downloadUrl) => {
      setWidgetClass('');
      setDownloadUrl(downloadUrl as string);
    });
  }, []);

  return (
    <div className={"version-update-widget " + widgetClass}>
      <div className="">
        <a href="#" onClick={openReleaseDownloadUrl}>
          New update available! Click here to download.
        </a>
      </div>
    </div>
  );
}
