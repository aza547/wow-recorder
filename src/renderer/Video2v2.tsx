let files: string[];

function getVideo() {
  window.electron.ipcRenderer.on('LISTRESPONSE', (arg) => {
    files = arg as string[];
  });

  window.electron.ipcRenderer.sendSync('LIST', ['ping']);

  if (files) {
    console.log("I have something");
    return "file:///D:/wow-recorder-files/2v2/" + files[0];
  } else {
      console.log("Nothing here...");
      return "";
  }
}

export default function Video() {
  return (
      <video className="video" id="video2v2" poster="file:///D:/Checkouts/wow-recorder/assets/2029165.jpg" controls>
        <source src={ getVideo() } />
      </video>
  );
}
