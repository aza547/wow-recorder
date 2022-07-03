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

DUNGEON_ZONES = {
  2291: "De Other Side",
  2287: "Halls of Atonement",
  2290: "Mists of Tirna Scithe",
  2289: "Plaguefall",
  2284: "Sanguine Depths",
  2285: "Spires of Ascension",
  2286: "The Necrotic Wake",
  2293: "Theater of Pain",
  2441: "Tazavesh the Veiled Market",
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
        self.category = None

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
        if ("ZONE_CHANGE" in line):
            zone = int(line.split(",")[1])

            isDungeon = (self.category == "Mythic+")
            isRaid = (self.category == "Raids")
            isArena = (self.category == "2v2") or (self.category == "3v3") or (self.category == "Skirmish") or (self.category == "Solo Shuffle")

            # End if player leaves the zone. 
            if (isDungeon) and (zone not in DUNGEON_ZONES):
                print(f"Detected ZONE_CHANGE, left dungeon" , flush=True)
                self.ended = True
            elif (isArena) and (zone not in ARENA_ZONES):
                print(f"Detected ZONE_CHANGE, left arena" , flush=True)
                self.ended = True
            elif (isRaid) and (zone not in RAID_ZONES):
                print(f"Detected ZONE_CHANGE, left raid" , flush=True)
                self.ended = True

        if "ARENA_MATCH_START" in line:
            print(f"Detected ARENA_MATCH_START event", flush=True)
            self.started = True
            self.ended = False

            ## Get the zone name from the ZONE_CHANGE event.
            zone = int(line.split(",")[1])

            if zone not in ARENA_ZONES:
              # Guard against new arena zones breaking everything.
              print(f"Invalid zone - stopping recording.", flush=True)
              self.ended = True
              self.flush_copied_log()
            else:
              self.zone = ARENA_ZONES[zone]
              self.zoneID = zone

            if "3v3" in line:
                print(f"It's 3v3 in {self.zone}", flush=True)
                self.category = "3v3"
            elif "2v2" in line:
                print(f"It's 2v2 in {self.zone}", flush=True)
                self.category = "2v2"
            elif "Skirmish" in line:
                print(f"It's a skirmish in {self.zone}", flush=True)
                self.category = "Skirmish"
            elif "Solo Shuffle" in line:
                print(f"It's a Solo Shuffle in {self.zone}", flush=True)
                self.category = "Solo Shuffle"

        elif "ENCOUNTER_START" in line:
            print(f"Detected ENCOUNTER_START event", flush=True)
            self.started = True
            self.ended = False

            # Get the encounter and zone name
            encounter = line.split(",")[2].replace('"', '') # comes in quotes so strip those
            zone = int(line.split(",")[1])
            self.zoneID = zone
            print(f"{encounter} encounter started in {self.zoneID}!", flush=True)
            self.category = "Raids"

        elif "CHALLENGE_MODE_START" in line:
            print(f"Detected CHALLENGE_MODE_START event", flush=True)
            self.started = True
            self.ended = False  
            self.zoneID = int(line.split(",")[2])
            self.zone = str(line.split(",")[1]).replace('"', '') # comes in quotes so strip those
            self.category = "Mythic+"
            print(f"Mythic+ started in {self.zone}!", flush=True)

        # Deliberatly before ARENA_MATCH_END handling to log that line for completeness.
        # Just push to list. We flush this to a file after the game.
        if self.is_active():
            self.output_log_lines.append(line)

        if ("ARENA_MATCH_END" in line):
            print(f"Detected ARENA_MATCH_END event", flush=True)
            self.ended = True
            self.flush_copied_log()
        elif ("ENCOUNTER_END" in line):
        ## easy to get win loss? 2nd to last arg is 1 for success or 0 for fail
        #  -- ENCOUNTER_END,2537,"The Jailer",16,20,0,112540
            print(f"Detected ENCOUNTER_END event", flush=True)
            self.ended = True
            self.flush_copied_log()
        elif ("CHALLENGE_MODE_END" in line):
            print(f"Detected CHALLENGE_MODE_END event", flush=True)
            self.ended = True
            self.flush_copied_log()

    def stop_follow(self):
        """Stop following the log file."""
        self.follow = False
