import os

CWD = os.path.dirname(__file__)

NAME = "rated_3v3"
LOG = f"{CWD}/../../logs/classic/{NAME}.txt"
OVERRUN = 3
OUTPUT = "Alexpals - 3v3 Dalaran (Win)"
SLEEPS = {
    "ZONE_CHANGE": 5,
    "UNIT_DIED": 1,
}
