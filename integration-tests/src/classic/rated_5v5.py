import os

CWD = os.path.dirname(__file__)

NAME = "rated_5v5"
LOG = f"{CWD}/../../logs/classic/{NAME}.txt"
OVERRUN = 3
OUTPUT = "Alexpals - 5v5 Ruins of Lordaeron (Loss)"
SLEEPS = {
    "ZONE_CHANGE": 5,
    "UNIT_DIED": 1,
}
