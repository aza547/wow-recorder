import time
import datetime
import random
import os


def replace_date(line):
    event_position = line.find("  ")
    line_no_ts = line[event_position:]
    new_date_string = datetime.datetime.now().strftime("%#m/%#d %H:%M:%S.%f")[:-3]
    retstr = new_date_string + line_no_ts;
    print (retstr)
    return retstr

dirname = os.path.dirname(__file__)
LOG_PATH = "D:/World of Warcraft/_classic_/Logs"
SAMPLE_LOG = os.path.join(dirname, "../example-logs/classic/rated_2v2.txt")

# Open a combat log ready for writing.
randomNumber = random.random()
logName = f"WoWCombatLog-{randomNumber}.txt"
logFile = open(f"{LOG_PATH}/{logName}", "w", encoding="utf-8")

# Load the sample combat log into memory.
sample_log = open(SAMPLE_LOG, 'r', encoding="utf-8")
sample_log_lines = sample_log.readlines()

# If ARENA_MATCH_START is the first line we don't start recording 
# but this never happens in reality so just write a line. 
logFile.write("This is a test line to create the file\n")
time.sleep(2)

print("Starting")

# Write each line from the example to the fake log.
for line in sample_log_lines:
    if ("ZONE_CHANGE" in line) or ("UNIT_DIED" in line):
        # Sleep before writing the end event so we actually record something. 
        time.sleep(5)
    logFile.write(replace_date(line))

print("Done")
logFile.close()