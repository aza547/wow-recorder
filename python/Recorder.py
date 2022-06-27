import time
import os
from datetime import datetime
from pathlib import Path
import os
import subprocess


class Recorder:
    def __init__(self, zoneID, bracket, cfg):
        """Constructor."""
        self.zoneID = zoneID
        self.bracket = bracket
        self.cfg = cfg

        # Get an appropriate file name and path.
        self.video_path = self.cfg["video_storage"]
        self.ffmpeg_path = self.cfg["ffmpeg_path"]
        self.hwe = self.cfg['hwe']
        self.file_name = f"{self.video_path}/{self.bracket}/{self.zoneID}.mp4"

    def get_path(self):
        """Return the path of the video file as a Path object."""
        return Path(self.file_name)

    def get_final_path(self):
        """Return the path of the final video file as a Path object."""
        return Path(self.final_file_name)

    def start_recording(self):
        """Call ffmpeg to start the recording."""
        self.start_time_seconds = round(time.time())    

        cmd = f'{self.cfg["ffmpeg_path"]} -y -thread_queue_size 1024 -f gdigrab -framerate 30 -video_size 1920x1080 -i desktop -r 30 -preset fast '

        # Enable hardware encoding if possible. 
        if (self.hwe == "NVIDIA"):
            cmd = cmd + '-c:v h264_nvenc '
        elif (self.hwe == "AMD"): 
            cmd = cmd + '-c:v h264_amf '

        cmd = cmd + f'-qp 23 -pix_fmt yuv420p "{self.file_name}"'

        # Mic capture -- requires setup
        #  -f dshow -i audio="Microphone (3- G533 Gaming Headset)"

        # Audio capture -- requires setup
        #  -f dshow -i audio="virtual-audio-capturer"      

        with open(f"{self.video_path}/diags/ffmpeg.log", "a") as ffmpeg_log:

            ffmpeg_log.write("\n\nffmpeg commmand: " + cmd + "\n\n")

            self.recording_process = subprocess.Popen(
                cmd, stdin=subprocess.PIPE, stdout=ffmpeg_log, stderr=ffmpeg_log, shell=True
          )

        print("STARTED RECORDING", flush=True)

    def stop_recording(self):
        """Pass q to the subprocess to signal ffmpeg to stop recording."""
        self.end_time_seconds = round(time.time())
        self.duration_seconds = (self.end_time_seconds - self.start_time_seconds)
        self.recording_process.communicate("q".encode("utf-8"))
        time.sleep(1)
        video_path = self.cfg["video_storage"]
        self.final_file_name = f"{video_path}/{self.bracket}/{self.zoneID}-{self.duration_seconds}-{self.start_time_seconds}.mp4"
        os.rename(self.file_name, self.final_file_name)
        print("STOPPED RECORDING", flush=True)
