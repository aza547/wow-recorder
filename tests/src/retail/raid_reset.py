import os

CWD = os.path.dirname(__file__)

NAME = "raid_reset"
LOG = f"{CWD}/../../logs/retail/{NAME}.txt"
OVERRUN = 0 # It's a reset, so no overrun
OUTPUT = None
SLEEPS = {
    "ENCOUNTER_END": 2,
}
