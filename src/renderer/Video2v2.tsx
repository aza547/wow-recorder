let files: string[];

// calling IPC exposed from preload script
window.electron.ipcRenderer.on('LISTRESPONSE', (arg) => {
  // eslint-disable-next-line no-console
  files = arg;
});
window.electron.ipcRenderer.sendMessage('LIST', ['ping']);

function getVideo() {
  return "file:///D:/wow-recorder-files/2v2/" + files[0];
}

export default function Video() {
  return (
    <video className="video" controls>
      <source src={getVideo()} />
    </video>
  );
}
