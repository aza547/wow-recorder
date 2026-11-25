import os

CWD = os.path.dirname(__file__)

NAME = "raid"
LOG = f"{CWD}/../../logs/forever/{NAME}.txt"
OVERRUN = 15
OUTPUT = "" ## TODO
SLEEPS = {
    "ENCOUNTER_END": 20
}
