import os

CWD = os.path.dirname(__file__)

NAME = "rated_2v2_extra_units"
LOG = f"{CWD}/../../logs/classic/{NAME}.txt"
OVERRUN = 3
OUTPUT = "Jammln - 2v2 Dalaran (Loss)"
SLEEPS = {
    "UNIT_DIED": 5,
}
