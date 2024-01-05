import os

CWD = os.path.dirname(__file__)

NAME = "raid_wipe"
LOG = f"{CWD}/../../logs/retail/{NAME}.txt"
OVERRUN = 0 # It's a wipe, so no overrun
OUTPUT = "Alexsmite - Sepulcher of the First Ones, Lihuvim, Principal Architect [HC] (Wipe)"
SLEEPS = {
    "ENCOUNTER_END": 20,
}
