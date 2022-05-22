import time
import os
from datetime import datetime
from pathlib import Path
import os
import subprocess


class Recorder:
    def __init__(self, zone, bracket, cfg):
        """Constructor."""
        self.zone = zone
        self.bracket = bracket
        self.cfg = cfg

        # Get an appropriate file name and path.
        now = datetime.now()
        current_time = now.strftime("%H.%M.%S")
        video_path = self.cfg["video_storage"]
        self.file_name = f"{video_path}/{self.bracket}-{self.zone}-{current_time}.mp4"

    def get_path(self):
        """Return the path of the video file as a Path object."""
        return Path(self.file_name)

    def start_recording(self):
        """Call ffmpeg to start the recording."""
        cmd = f'ffmpeg                                                     \
        -thread_queue_size 1024                                            \
        -f gdigrab -framerate 50 -video_size 1920x1080 -i desktop          \
        -f dshow -i audio="virtual-audio-capturer"                         \
        -r 50 -preset fast -c:v h264_nvenc -qp 23 -pix_fmt yuv420p         \
        "{self.file_name}"'

        #  -f dshow -i audio="Microphone (3- G533 Gaming Headset)"
        self.recording_process = subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, shell=True
        )

    def stop_recording(self):
        """Pass q to the subprocess to signal ffmpeg to stop recording."""
        self.recording_process.communicate("q".encode("utf-8"))
