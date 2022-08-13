import time
import random

length = 2
path = "D:/World of Warcraft/_retail_/Logs"
randomNumber = random.random()
logName = f"WoWCombatLog-{randomNumber}.txt"
path = "D:/World of Warcraft/_retail_/Logs"

encounterIDs = [
    2537,
    2512,
    2529,
    2539,
    2540,
    2542,
    2543,
    2544,
    2546,
    2549,
    2553
]

encounter = random.choice(encounterIDs)
success = random.choice([0, 1])

START = f"\n21:41:14.016  ENCOUNTER_START,{encounter},\"The Jailer\",14,19,2481"
RANDOM = "\n21:42:07.496  SPELL_AURA_REMOVED,Player-3674-09A05CAE,\"Ziniq-TwistingNether\",0x512,0x0,Creature-0-4255-2481-2964-180990-000028F722,\"The Jailer\",0x10a48,0x0,589,\"Shadow Word: Pain\",0x20,DEBUFF"
END = f"\n3/9 21:42:07.568  ENCOUNTER_END,{encounter},\"The Jailer\",14,19,{success},53502"

f = open(f"{path}/{logName}", "a")
f.write("random first line data")
f.close()
time.sleep(1)

print("Writing START")
f = open(f"{path}/{logName}", "a")
f.write(START)
f.close()
time.sleep(2)

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
time.sleep(1)