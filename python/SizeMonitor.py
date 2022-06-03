import os
import glob
from time import time
from pathlib import Path


class SizeMonitor:
    def __init__(self, cfg):
        """Constructor"""
        self.cfg = cfg
        self.interval = 1
        self.last_check_time = 0

        self.path = self.cfg["video_storage"]
        self.metadata_path = self.cfg["wow_logs"]
        self.max_size_gb = self.cfg["max_storage"]

    def run(self):
        """Call to do work."""
        if (time() - self.last_check_time) > self.interval:
            self.last_check_time = time()

            # Don't just delete one file, that might not make enough room.
            while self.check():
                print("Deleting oldest video")
                self.delete_oldest_video()

    def check(self):
        """Check if the size of directory is more than the limit."""
        size = self.get_dir_size()
        limit = int(self.max_size_gb)
        print(f"Size monitor results: Used:{size}, Limit:{limit}")
        return size > limit

    def get_dir_size(self):
        """Get the sum of the sizes of all the videos in {self.path}."""
        total_size = 0

        for root, dirs, files in os.walk(self.path):
            for f in files:
                total_size += os.path.getsize(os.path.join(root, f))

        return total_size / 1024 ** 3

    def delete_oldest_video(self):
        """Find the oldest video in {self.path} and remove it and the corresponding log snippet."""

        # Glob for the oldest video.
        videos = glob.glob(f"{self.path}/*.mp4")
        oldest_video = min(videos, key=os.path.getmtime)

        # Stitch together the path to the CombatLog for the corresponding video.
        corresponding_log = f"{self.metadata_path}/{Path(oldest_video).stem}.txt"

        # Remove video and log.
        # Don't kill the whole program if not found.
        try:
            os.remove(oldest_video)
            os.remove(corresponding_log)
        except:
            pass

        # Write to the log tab that this happened.
        # self.GUI.logger.warning(
        #     f"Removed {os.path.basename(oldest_video)} to comply with {self.max_size_gb}GB storage limit."
        # )
        print(f"Removed {os.path.basename(oldest_video)} to comply with {self.max_size_gb}GB storage limit.")
