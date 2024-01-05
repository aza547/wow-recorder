import os

CWD = os.path.dirname(__file__)

NAME = "skirmish"
LOG = f"{CWD}/../../logs/retail/{NAME}.txt"
OVERRUN = 3
OUTPUT = "Alexsmite - Skirmish Nagrand (Win)"
SLEEPS = {
    "ARENA_MATCH_START": 2,
    "ARENA_MATCH_END": 1,
}
