import time
import os

dirname = os.path.dirname(__file__)

tests = {
    # Retail Tests
    "Retail: Rated 2v2":          os.path.join(dirname, "./retail/rated_2v2.py"),
    "Retail: Rated 2v2 AFK Out":  os.path.join(dirname, "./retail/rated_2v2_afk_out.py"),
    "Retail: Rated 3v3":          os.path.join(dirname, "./retail/rated_3v3.py"),
    "Retail: Skirmish":           os.path.join(dirname, "./retail/skirmish.py"),
    "Retail: Brawl Solo Shuffle": os.path.join(dirname, "./retail/brawl_solo_shuffle.py"),
    "Retail: Rated Solo Shuffle": os.path.join(dirname, "./retail/rated_solo_shuffle.py"),
    "Retail: Mythic+":            os.path.join(dirname, "./retail/mythic_plus.py"),
    "Retail: Raid":               os.path.join(dirname, "./retail/raid.py"),
    "Retail: Raid Reset":         os.path.join(dirname, "./retail/raid_reset.py"),
    "Retail: Rated BG":           os.path.join(dirname, "./retail/rated_battleground.py"),
    "Retail: Zone Changes":       os.path.join(dirname, "./retail/zone_changes.py"),

    # Classic Tests
    "Classic: Raid":     os.path.join(dirname, "./classic/raid.py"),
    "Classic: Rated 2v2": os.path.join(dirname, "./classic/rated_2v2.py"),
    "Classic: Rated 5v5": os.path.join(dirname, "./classic/rated_5v5.py"),
}

for test in tests:
    print(f"Running {test}")
    exec(open(tests[test]).read())
    time.sleep(30)

print("Done!")
