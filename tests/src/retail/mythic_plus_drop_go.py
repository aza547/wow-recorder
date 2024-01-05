import os

CWD = os.path.dirname(__file__)

NAME = "mythic_plus_drop_go"
LOG = f"{CWD}/../../logs/retail/{NAME}.txt"
OVERRUN = 5
OUTPUT = "Vutar - Dawn of the Infinite +20 (+1)"
SLEEPS = {
    "CHALLENGE_MODE_END": 1,
    "ENCOUNTER_END": 1,
}
