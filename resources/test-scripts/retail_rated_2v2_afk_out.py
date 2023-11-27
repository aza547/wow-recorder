import random
import os
import test_utils
from test_utils import replace_date as rd, close_sleep_open as cso

dirname = os.path.dirname(__file__)
LOG_PATH = test_utils.RETAIL_LOG_PATH
SAMPLE_LOG = os.path.join(dirname, "../example-logs/retail/rated_2v2_afk_out.txt")

# Open a combat log ready for writing.
randomNumber = random.random()
logName = f"WoWCombatLog-{randomNumber}.txt"
logPath = f"{LOG_PATH}/{logName}"
logFile = open(logPath, "w", encoding="utf-8")

# Load the sample combat log into memory.
sample_log = open(SAMPLE_LOG, 'r', encoding="utf-8")
sample_log_lines = sample_log.readlines()



print("Starting")

# Write each line from the example to the fake log.
for line in sample_log_lines:
    if "ZONE_CHANGE" in line:
        # Sleep before writing the end event so we actually record something. 
        logFile = cso(logFile, 10, logPath)
    logFile.write(rd(line))

print("Done")
logFile.close()




