import os

CWD = os.path.dirname(__file__)

NAME = "mop_challenge_mode"
LOG = f"{CWD}/../../logs/classic/{NAME}.txt"
OVERRUN = 5
OUTPUT = "Desiredcell - Scholomance +0 (+3)"
SLEEPS = {
    "CHALLENGE_MODE_END": 1,
    "ENCOUNTER_END": 1,
}
