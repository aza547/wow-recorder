function getVideo() {
  return "file:///D:/wow-recorder-files/2v2/Game 1.mp4";
}

export default function Video() {
  return (
      <video className="video" id="video2v2" poster="file:///D:/Checkouts/wow-recorder/assets/2029165.jpg" controls>
        <source src={ getVideo() } />
      </video>

  );
}
