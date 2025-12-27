import os

CWD = os.path.dirname(__file__)

NAME = "mythic_plus_ditch_into_raid"
LOG = f"{CWD}/../../logs/retail/{NAME}.txt"
OVERRUN = 5

# Expect an M+ to be force ended, and a raid to be recorded.
OUTPUT = [
  "Alexsmite - Sepulcher of the First Ones, Lihuvim, Principal Architect [HC] (Wipe)",
  "Arcanedemon - The Stonevault +10 (Abandoned)",
]

SLEEPS = {
    "CHALLENGE_MODE_START": 2,
    "ENCOUNTER_END": 20,
    "ENCOUNTER_START": 2,
}
