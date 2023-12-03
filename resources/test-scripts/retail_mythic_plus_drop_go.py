import random
import os
import test_utils
from test_utils import replace_date as rd, close_sleep_open as cso

# Tests we can handle the scenario where:
# - Group starts key an exits dungeon.
# - Dungeon is reset.
# - Next key starts. 
#
# We should record the first key as deleted, then record the 
# entire subsequent key.

dirname = os.path.dirname(__file__)
LOG_PATH = test_utils.RETAIL_LOG_PATH
SAMPLE_LOG = os.path.join(dirname, "../example-logs/retail/mythic_plus_drop_go.txt")

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
    if "CHALLENGE_MODE_END" in line:
        logFile = cso(logFile, 5, logPath)
    elif "ENCOUNTER_END" in line:
        logFile = cso(logFile, 2, logPath)
        
    logFile.write(rd(line))
    
print("Done")
logFile.close()




