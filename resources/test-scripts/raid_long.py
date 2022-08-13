import time

path = "D:/World of Warcraft/_retail_/Logs"

f = open(f"{path}/WoWCombatLog-123.txt", "a")

START = "\n21:41:14.016  ENCOUNTER_START,2537,\"The Jailer\",14,19,2481"
END = "\n3/9 21:42:07.568  ENCOUNTER_END,2537,\"The Jailer\",14,19,0,53502"
RANDOM = "\n21:42:07.496  SPELL_AURA_REMOVED,Player-3674-09A05CAE,\"Ziniq-TwistingNether\",0x512,0x0,Creature-0-4255-2481-2964-180990-000028F722,\"The Jailer\",0x10a48,0x0,589,\"Shadow Word: Pain\",0x20,DEBUFF"


print("Writing START")
f = open(f"{path}/WoWCombatLog-123.txt", "a")
f.write(START)
f.close()
time.sleep(20)

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
