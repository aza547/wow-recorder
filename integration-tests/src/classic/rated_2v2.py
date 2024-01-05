import os

CWD = os.path.dirname(__file__)

NAME = "rated_2v2"
LOG = f"{CWD}/../../logs/classic/{NAME}.txt"
OVERRUN = 3
OUTPUT = "Alexpals - 2v2 Blade's Edge (Win)"
SLEEPS = {
    "ZONE_CHANGE": 5,
    "UNIT_DIED": 1,
}
