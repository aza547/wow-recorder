import os

CWD = os.path.dirname(__file__)

NAME = "mythic_plus_repair"
LOG = f"{CWD}/../../logs/retail/{NAME}.txt"
OVERRUN = 5
OUTPUT = "Vutar - Dawn of the Infinite +18 (+3)"
BOSSES = 4
SLEEPS = {
    "CHALLENGE_MODE_END": 1,
    "ENCOUNTER_END": 1,
}

