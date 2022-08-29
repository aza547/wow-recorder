import time
import os

dirname = os.path.dirname(__file__)

tests = {
    "2v2": os.path.join(dirname, "./2v2.py"),
    "3v3": os.path.join(dirname, "./3v3.py"),
    "Skirmish": os.path.join(dirname, "./skirmish.py"),
    "Solo Shuffle": os.path.join(dirname, "./soloshuffle.py"),
    "Raid": os.path.join(dirname, "./raid.py"),
    "Rated BG": os.path.join(dirname, "./rbg.py"),
}

for test in tests:
    print(f"Running {test}")
    exec(open(tests[test]).read())
    time.sleep(20)

print("Done!")
