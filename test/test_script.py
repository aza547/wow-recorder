import time

path = "D:/World of Warcraft/_retail_/Logs"

f = open(f"{path}/WoWCombatLog-123.txt", "a")

ZONE = "\n10/15 12:39:02.457  ZONE_CHANGE,1825,\"Hook Point\",0"
START = "\n10/15 12:39:44.614  ARENA_MATCH_START,1825,31,2v2,0"
END = "\n10/15 12:40:45.829  ARENA_MATCH_END,1,61,300,200"
RANDOM = "\n11/27 17:14:23.819  SPELL_AURA_REMOVED,Pet-0-3109-1134-8675-165189-010380FB8D,\"Reban\",0x1112,0x0,Pet-0-3109-1134-8675-165189-010380FB8D,\"Reban\",0x1112,0x0,32727,\"Arena Preparation\",0x1,BUFF"

print("Writing ZONE")
f.write(ZONE)
f.close()
time.sleep(2)


print("Writing START")
f = open(f"{path}/WoWCombatLog-123.txt", "a")
f.write(START)
f.close()
time.sleep(25)

f = open(f"{path}/WoWCombatLog-123.txt", "a")
f.write(RANDOM)
f.write(RANDOM)
f.write(RANDOM)
f.write(RANDOM)
f.close()

print("Writing END")
f = open(f"{path}/WoWCombatLog-123.txt", "a")
f.write(END)
f.close()
