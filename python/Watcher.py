import os
import glob
import threading
import sys
from time import sleep
from Combatlog import Combatlog
from Recorder import Recorder
from SizeMonitor import SizeMonitor


class Watcher:
    def __init__(self, cfg):
        """Constructor"""
        self.cfg = cfg
        self.keepwatching = True
        self.current_log_path = None
        self.current_combat_log = None
        self.size_monitor = SizeMonitor(self.cfg)

    def watch(self):
        """Watch the WoW logs directory."""

        while self.keepwatching:
            all_logs = glob.glob(f"{self.cfg['wow_logs']}/WoWCombatLog*")

            if self.current_log_path != max(all_logs, key=os.path.getmtime):

                # Stop following a noncurrent current_combat_log.
                self.close_combatlog()

                self.current_log_path = max(all_logs, key=os.path.getmtime)
                self.current_combat_log = Combatlog(self.current_log_path, self.cfg)

                # # Start a thread to follow the log.
                # self.GUI.logger.debug(
                #     f"Started watching: {os.path.basename(self.current_log_path)}"
                # )
                threading.Thread(target=self.current_combat_log.follow).start()

            if self.current_combat_log.is_active():

                # Create recording object.
                recorder = Recorder(
                    self.current_combat_log.zone,
                    self.current_combat_log.bracket,
                    self.cfg
                )

                # Start recording in a thread.
                # self.GUI.logger.info(f"Started recording")
                threading.Thread(target=recorder.start_recording).start()

                # Block until the arena match is over.
                while self.current_combat_log.is_active():
                    sleep(1)

                # Stop recording now the game is over.
                # self.GUI.logger.info(f"Stopped recording")
                recorder.stop_recording()

                # Avoid trying to do things before this is released.
                sleep(2)

                # Rename the log to match the video name.
                # TODO remove hardcoding of path.
                log_path = self.current_combat_log.get_copied_log()
                vid_path = recorder.get_path()
                os.rename(
                    log_path,
                    self.cfg["video_storage"]
                    + "/metadata/"
                    + vid_path.stem
                    + log_path.suffix,
                )

                # Run the size monitor.
                self.size_monitor.run()

                # # Refresh GUI.
                # self.GUI.refresh_video_list()
                # self.GUI.refresh_usage()

            sleep(1)

        # If we got to here then the program is trying to exit, clean up threads.
        self.close_combatlog()

    def stop_watching(self):
        self.keepwatching = False

    def close_combatlog(self):
        """Lazy try/except handling to avoid erroring on startup."""
        try:
            self.current_combat_log.stop_follow()
            # self.GUI.logger.debug(
            #     f"Stopped watching: {os.path.basename(self.current_log_path)}"
            # )
        except:
            pass
