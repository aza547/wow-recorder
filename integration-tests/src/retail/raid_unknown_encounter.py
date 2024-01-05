import os

CWD = os.path.dirname(__file__)

NAME = "raid_unknown_encounter"
LOG = f"{CWD}/../../logs/retail/{NAME}.txt"
OVERRUN = 0 # It's a wipe, so no overrun
OUTPUT = "Alexsmite - Void Lord Top Dog [HC] (Wipe)"
SLEEPS = {
    "ENCOUNTER_END": 20,
}
