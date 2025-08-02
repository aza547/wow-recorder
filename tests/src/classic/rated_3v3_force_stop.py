import os

CWD = os.path.dirname(__file__)

NAME = "rated_3v3_force_stop"
LOG = f"{CWD}/../../logs/classic/{NAME}.txt"
OVERRUN = 3
OUTPUT = "Alexpals - 3v3 Dalaran (Loss)"
SLEEPS = {
    "ZONE_CHANGE": 5,
    "UNIT_DIED": 1,
    "WARCRAFT_RECORDER_FORCE_STOP": 2,
}
