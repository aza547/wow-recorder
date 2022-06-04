import os
from time import time, sleep
from pathlib import Path
import configparser

ARENA_ZONES = {
  1672: "Blade's Edge Arena",
  617: "Dalaran Arena",
  1505: "Nagrand Arena",
  572: "Ruins of Lordaeron",
  2167: "The Robodrome",
  1134: "Tiger's Peak",
  980: "Tol'Viron Arena",
  1504: "Black Rook Hold Arena",
  2373: "Empyrean Domain",
  1552: "Ashamane's Fall",
  1911: "Mugambala",
  1825: "Hook Point",
  2509: "Maldraxxus Coliseum",
  2547: "Enigma Crucible"
}

RAID_ZONES = {
  2537: "Sepulcher of the First Ones"
}


class Combatlog:
    def __init__(self, path, cfg):
        """Constructor"""
        self.path = path
        self.filehandle = open(path, "r", encoding="utf-8")
        self.keepwatching = True
        self.cfg = cfg

        self.zone = "UnknownZone"
        self.zoneID = 0
        self.bracket = None

        self.started = False
        self.ended = False
        self.winner = None

        self.output_log_lines = []
        self.output_log_path = Path(
            self.cfg["video_storage"] + "/metadata/rename.txt"
        )

    def is_empty(self):
        """Check if the combat log is an empty file"""
        return os.path.getsize(self.path) == 0

    def is_active(self):
        """ """
        return self.started and not self.ended

    def flush_copied_log(self):
        """Write all the logs lines in self.output_log_lines to a temp file.
        This gets picked up by the Watcher class and renamed to match the
        video file."""

        # Create the file.
        self.output_log_path.touch()
        self.output_log_file = open(self.output_log_path, "a", encoding="utf-8")

        # Write each line to the file in turn.
        for line in self.output_log_lines:
            self.output_log_file.write(line)

        # Close the file handle.
        self.output_log_file.close()

        # Reset the list to be empty now we've flushed it to a file.
        self.output_log_lines = []

    def get_copied_log(self):
        """Get the file path of the most recent copied log."""
        return Path(self.output_log_path)

    def follow(self):
        """Follow the log file."""

        self.filehandle.seek(0, 2)
        self.follow = True

        while self.follow:
            line = self.filehandle.readline()

            if line:
                self.handle_line(line)
                last_line_read = time()
            else:
                sleep(0.1)

    def handle_line(self, line):
        """Parse a line of the combat log looking for anything interesting."""
        if "ZONE_CHANGE" in line:

            ## Get the zone ID from the ZONE_CHANGE event.
            zone = int(line.split(",")[1])

            # Get the zone.
            if zone not in ARENA_ZONES:
                print(f"Detected ZONE_CHANGE, left arena")
                self.ended = True

        if "ARENA_MATCH_START" in line:
            print(f"Detected ARENA_MATCH_START event")
            self.started = True
            self.ended = False

            ## Get the zone name from the ZONE_CHANGE event.
            zone = int(line.split(",")[1])

            if zone not in ARENA_ZONES:
              # Guard against new arena zones breaking everything.
              print(f"Invalid zone - stopping recording.")
              self.ended = True
              self.flush_copied_log()
            else:
              self.zone = ARENA_ZONES[zone]
              self.zoneID = zone

            if "3v3" in line:
                print(f"It's 3v3 in {self.zone}")
                self.bracket = "3v3"
            elif "2v2" in line:
                print(f"It's 2v2 in {self.zone}")
                self.bracket = "2v2"
            elif "Skirmish" in line:
                print(f"It's a skirmish in {self.zone}")
                self.bracket = "Skirmish"
            elif "Solo Shuffle" in line:
                print(f"It's a Solo Shuffle in {self.zone}")
                self.bracket = "Solo Shuffle"

        elif "ENCOUNTER_START" in line:
            print(f"Detected ENCOUNTER_START event")
            self.started = True
            self.ended = False

            # Get the encounter and zone name
            encounter = line.split(",")[2].replace('"', '') # comes in quotes so strip those
            zone = int(line.split(",")[1])
            self.zoneID = zone
            print(f"{encounter} encounter started in {self.zoneID}!")
            self.bracket = "Raids"

        # Deliberatly before ARENA_MATCH_END handling to log that line for completeness.
        # Just push to list. We flush this to a file after the game.
        if self.is_active():
            self.output_log_lines.append(line)

        if ("ARENA_MATCH_END" in line):
            print(f"Detected ARENA_MATCH_END event")
            self.ended = True
            self.flush_copied_log()
        elif ("ENCOUNTER_END" in line):
        ## easy to get win loss? 2nd to last arg is 1 for success or 0 for fail
        #  -- ENCOUNTER_END,2537,"The Jailer",16,20,0,112540
            print(f"Detected ENCOUNTER_END event")
            self.ended = True
            self.flush_copied_log()

    def stop_follow(self):
        """Stop following the log file."""
        self.follow = False
