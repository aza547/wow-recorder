import time
import random

length = 2
path = "D:/World of Warcraft/_retail_/Logs"
randomNumber = random.random()
logName = f"WoWCombatLog-{randomNumber}.txt"

arenaTypes = [
    "2v2",
    "3v3",
    "Skirmish",
    "Solo Shuffle"
]

arenaIDs = [
    1672,
    617,
    1505,
    572,
    2167,
    1134,
    980,
    1504,
    2373,
    1552,
    1911,
    1825,
    2509,
    2547
]

arenaType = random.choice(arenaTypes)
arenaID = random.choice(arenaIDs)

f = open(f"{path}/{logName}", "a")

ZONE = "\n10/15 12:39:02.457  ZONE_CHANGE,1825,\"Hook Point\",0"
START = f"\n10/15 12:39:44.614  ARENA_MATCH_START,{arenaID},31,{arenaType},0"
END = "\n10/15 12:40:45.829  ARENA_MATCH_END,1,61,300,200"
RANDOM = "\n11/27 17:14:23.819  SPELL_AURA_REMOVED,Pet-0-3109-1134-8675-165189-010380FB8D,\"Reban\",0x1112,0x0,Pet-0-3109-1134-8675-165189-010380FB8D,\"Reban\",0x1112,0x0,32727,\"Arena Preparation\",0x1,BUFF"

print("Writing ZONE")
f.write(ZONE)
f.close()
time.sleep(1)


print("Writing START")
f = open(f"{path}/{logName}", "a")
f.write(START)
f.close()
time.sleep(length)

f = open(f"{path}/{logName}", "a")
f.write(RANDOM)
f.write(RANDOM)
f.write(RANDOM)
f.write(RANDOM)
f.close()

print("Writing END")
f = open(f"{path}/{logName}", "a")
f.write(END)
f.close()

time.sleep(5)

