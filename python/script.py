
from pathlib import Path
import os
import sys

video_paths = Path("D:/wow-recorder-files/2v2").iterdir()
sorted_videos = sorted(video_paths, key=os.path.getmtime, reverse=True)

for vid in sorted_videos:
  print("file:///" + str(vid))

sys.stdout.flush()
