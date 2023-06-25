import time
import os

dirname = os.path.dirname(__file__)

tests = {
    # Retail Tests
    "Retail: Rated 2v2":          os.path.join(dirname, "./retail_rated_2v2.py"),
    "Retail: Rated 2v2 AFK Out":  os.path.join(dirname, "./retail_rated_2v2_afk_out.py"),
    "Retail: Rated 3v3":          os.path.join(dirname, "./retail_rated_3v3.py"),
    "Retail: Skirmish":           os.path.join(dirname, "./retail_skirmish.py"),
    "Retail: Rated Solo Shuffle": os.path.join(dirname, "./retail_rated_solo_shuffle.py"),
    "Retail: Mythic+":            os.path.join(dirname, "./retail_mythic_plus.py"),
    "Retail: Known Raid Encounter":    os.path.join(dirname, "./retail_raid.py"),
    "Retail: Unknown Raid Encounter":  os.path.join(dirname, "./retail_unknown_raid_encounter.py"),
    "Retail: Raid Reset":         os.path.join(dirname, "./retail_raid_reset.py"),
    "Retail: Rated BG":           os.path.join(dirname, "./retail_rated_battleground.py"),
    "Retail: Zone Changes":       os.path.join(dirname, "./retail_zone_changes.py"),
    "Retail: 3v3 War Game":       os.path.join(dirname, "./retail_wargame_3v3.py"),

    # Classic Tests
    "Classic: Raid":          os.path.join(dirname, "./classic_raid.py"),
    "Classic: Rated 2v2":     os.path.join(dirname, "./classic_rated_2v2.py"),
    "Classic: Rated 3v3":     os.path.join(dirname, "./classic_rated_3v3.py"),
    "Classic: Rated 5v5":     os.path.join(dirname, "./classic_rated_5v5.py"),
    "Classic: Battleground":  os.path.join(dirname, "./classic_battleground.py"),

    # Tests we can run back to back recording if there is no gap in end/start events.
    "Classic: Double Rated 2v2":     os.path.join(dirname, "./double_classic_rated_2v2.py"),
}

for test in tests:
    print(f"Running {test}")
    exec(open(tests[test]).read())
    time.sleep(30)

print("Done!")
