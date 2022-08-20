import time
import random

LOG_PATH = "D:/World of Warcraft/_retail_/Logs"
SAMPLE_LOG = "D:/checkouts/wow-recorder/resources/example-logs/2v2.txt"

# Open a combat log ready for writing.
randomNumber = random.random()
logName = f"WoWCombatLog-{randomNumber}.txt"
logFile = open(f"{LOG_PATH}/{logName}", "w")

# Load the sample combat log into memory.
sample_log = open(SAMPLE_LOG, 'r')
sample_log_lines = sample_log.readlines()

# If ARENA_MATCH_START is the first line we don't start recording 
# but this never happens in reality so just write a line. 
logFile.write("This is a test line to create the file")
time.sleep(1)

print("Starting")

# Write each line from the example to the fake log.
for line in sample_log_lines:
    if "ARENA_MATCH_END" in line:
        # Sleep before writing the end event so we actually record something. 
        time.sleep(2)
    logFile.write(line)

print("Done")
logFile.close()




