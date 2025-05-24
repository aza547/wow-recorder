import os

# Tests that we handle the case where no bosses are pulled in a Mythic+ dungeon.
# As a result no COMBATANT_INFO events are fired but we still want to save the abandoned run.
CWD = os.path.dirname(__file__)

NAME = "mythic_plus_no_boss"
LOG = f"{CWD}/../../logs/retail/{NAME}.txt"
OVERRUN = 5
OUTPUT = "Arcanedemon - The Stonevault +10 (Abandoned)"
SLEEPS = { "WARCRAFT_RECORDER_FORCE_STOP": 2 }
