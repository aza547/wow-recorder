import os

CWD = os.path.dirname(__file__)

NAME = "rated_2v2_double"
LOG = f"{CWD}/../../logs/classic/{NAME}.txt"
OVERRUN = 3
OUTPUT = "Alexpals - 2v2 Blade's Edge (Win)"
SLEEPS = {
    "UNIT_DIED": 10, # If too quick then the UI will group the tests (start time needs to be > 10s apart)
}
