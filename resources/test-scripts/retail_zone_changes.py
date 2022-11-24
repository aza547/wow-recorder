import time
import random
import os
import test_utils
from test_utils import replace_date as rd

dirname = os.path.dirname(__file__)
LOG_PATH = test_utils.RETAIL_LOG_PATH
SAMPLE_LOG = os.path.join(dirname, "../example-logs/retail/zone_changes.txt")

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
    if "ZONE_CHANGE" in line:
        # Sleep before writing the end event so we actually record something. 
        time.sleep(1)
    logFile.write(rd(line))

print("Done")
logFile.close()




