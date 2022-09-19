import time
import random
import os

dirname = os.path.dirname(__file__)
LOG_PATH = "D:/World of Warcraft/_retail_/Logs"
SAMPLE_LOG = os.path.join(dirname, "../example-logs/2v2.txt")

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
    if "ARENA_MATCH_END" in line:
        # Sleep before writing the end event so we actually record something. 
        time.sleep(10)
    logFile.write(line)

print("Done")
logFile.close()




