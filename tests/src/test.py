import datetime
import os
import random
import argparse
import sys
import json
from time import sleep
from glob import glob

# Import the retail tests
import retail.mythic_plus
import retail.mythic_plus_drop_go
import retail.mythic_plus_repair
import retail.mythic_plus_no_boss
import retail.raid_wipe
import retail.raid_reset
import retail.raid_unknown_encounter
import retail.rated_2v2
import retail.rated_2v2_afk_out
import retail.rated_3v3
import retail.rated_battleground
import retail.rated_solo_shuffle
import retail.skirmish
import retail.wargame_3v3
import retail.zone_changes

# Import the classic tests
import classic.battleground
import classic.raid
import classic.rated_2v2
import classic.rated_2v2_double
import classic.rated_3v3
import classic.rated_5v5
import classic.rated_2v2_extra_units
import classic.rated_2v2_feign_death

# Import the era tests
import era.raid

# These variables are environment dependent, you may need to adjust them.
RETAIL_LOG_PATH = "C:/Program Files/World of Warcraft/_retail_/Logs"
CLASSIC_LOG_PATH = "C:/Program Files/World of Warcraft/_classic_/Logs"
ERA_LOG_PATH = "C:/Program Files/World of Warcraft/_classic_era_/Logs"
PTR_LOG_PATH = "C:/Program Files/World of Warcraft/_xptr_/Logs"
STORAGE_PATH = "D:/wr-test"

CWD = os.path.dirname(__file__)

RETAIL_TESTS = [
    retail.mythic_plus,
    retail.mythic_plus_drop_go,
    retail.mythic_plus_repair,
    retail.mythic_plus_no_boss,
    retail.raid_reset,
    retail.raid_unknown_encounter,
    retail.raid_wipe,
    retail.rated_2v2_afk_out,
    retail.rated_2v2,
    retail.rated_3v3,
    retail.rated_battleground,
    retail.rated_solo_shuffle,
    retail.skirmish,
    retail.wargame_3v3,
    retail.zone_changes,
]

CLASSIC_TESTS = [
    classic.battleground,
    classic.raid,
    classic.rated_2v2,
    classic.rated_2v2_double,
    classic.rated_3v3,
    classic.rated_5v5,
    classic.rated_2v2_extra_units,
    classic.rated_2v2_feign_death,
]


ERA_TESTS = [
    era.raid,
]

PTR_TESTS = [
    # Log data is the same on PTR, unless it changes, but we can't predict that. 
    # This just exercises the PTR log path and PTR log handler with the same data as retail.
    retail.rated_2v2, 
]

RETAIL_TEST_NAMES = list(map(lambda t: t.NAME, RETAIL_TESTS))
CLASSIC_TEST_NAMES = list(map(lambda t: t.NAME, CLASSIC_TESTS))
ERA_TEST_NAMES = list(map(lambda t: t.NAME, ERA_TESTS))
PTR_TEST_NAMES = list(map(lambda t: t.NAME, PTR_TESTS))

# Define the CLI arguments.
parser = argparse.ArgumentParser(prog="Warcraft Recorder Tests")
parser.add_argument("-f", help="flavour", choices=["classic", "retail", "era", "ptr"])
parser.add_argument("-t", help="test", choices=RETAIL_TEST_NAMES + CLASSIC_TEST_NAMES + ERA_TEST_NAMES + PTR_TEST_NAMES)
args = parser.parse_args()


def replace_date(line, flavour):
    """Replaces the date in a log line with the current date in the original format."""
    event_position = line.find("  ")
    line_no_ts = line[event_position:]

    if flavour == "retail":
        # Retail started using the year in TWW.
        new_date_string = datetime.datetime.now().strftime("%#m/%#d/%Y %H:%M:%S.%f")[:-3]
    else:
        # Pre TWW we don't use the year.
        new_date_string = datetime.datetime.now().strftime("%#m/%#d %H:%M:%S.%f")[:-3]

    return new_date_string + line_no_ts


def get_latest_metadata():
    """Reads the latest metadata file as a dict."""
    files = glob(f"{STORAGE_PATH}/*.json")
    latest = max(files, key=os.path.getctime)

    with open(latest) as metadata_file:
        data = json.load(metadata_file)

    return data


def check_latest_mp4_contains(contains):
    """Checks that the most recent MP4 file in the STORAGE_PATH includes a substring."""
    files = glob(f"{STORAGE_PATH}/*.mp4")
    latest = max(files, key=os.path.getctime)

    if contains in latest:
        print("  MP4 existed as expected")
    else:
        print(f"FAILED: Latest MP4 did not contain {contains}, was {latest}")
        sys.exit(1)


def check_boss_count(num):
    """Check there was the correct number of bosses in the Mythic+ run."""
    metadata = get_latest_metadata()
    bosses = 0

    for entry in metadata["challengeModeTimeline"]:
        if entry["segmentType"] == "Boss":
            bosses += 1

    if bosses == num:
        print("  Boss count as expected")
    else:
        print(f"FAILED: Boss count not as expected, was {bosses} but expected {num}")
        sys.exit(1)


def close_sleep_open(file, sec, path):
    """Close a file handle, sleep, and then re-open the file with a new handle. This is
    required to emulate the behaviour of the WoW client writing logs."""
    file.close()
    sleep(sec)
    return open(path, "a", encoding="utf-8")


def get_test_log(flavour):
    """Randomly generate a file name for a test log and return the absolute path."""
    randomNumber = random.random()
    logName = f"WoWCombatLog-{randomNumber}.txt"

    if flavour == "retail":
        return f"{RETAIL_LOG_PATH}/{logName}"

    if flavour == "classic":
        return f"{CLASSIC_LOG_PATH}/{logName}"
    
    if flavour == "era":
        return f"{ERA_LOG_PATH}/{logName}"
    
    if flavour == "ptr":
        return f"{PTR_LOG_PATH}/{logName}"


def get_sample_log_lines(file):
    """Read a file into a list of lines."""
    sample_log = open(file, "r", encoding="utf-8")
    return sample_log.readlines()


def get_event(line):
    """Extracts the event name from a log line."""
    return line.split("  ")[1].split(",")[0]


def maybe_sleep(line, test, log_file, log_path):
    """Decides if we should sleep, and does so given the test and the event
    in the log line."""
    event = get_event(line)
    sleeps = test.SLEEPS

    if event in sleeps:
        sleep = sleeps[event]
        print(f"  Sleeping {sleep}s on {event}")
        log_file = close_sleep_open(log_file, sleep, log_path)

    return log_file


def find_test_by_name(flavour, test_name):
    """Find a test by its name, returning the entire test definition."""
    if flavour == "retail":
        test = list(filter(lambda test: test.NAME == test_name, RETAIL_TESTS))[0]
    elif flavour == "classic":
        test = list(filter(lambda test: test.NAME == test_name, CLASSIC_TESTS))[0]
    else:
        test = list(filter(lambda test: test.NAME == test_name, ERA_TESTS))[0]

    return test


def run_test(flavour, test):
    """Run a test."""
    print(f"Running {flavour} test {test.NAME}...")

    sample_log_lines = get_sample_log_lines(test.LOG)
    log_path = get_test_log(flavour)
    log_file = open(log_path, "w", encoding="utf-8")

    for line in sample_log_lines:
        log_file = maybe_sleep(line, test, log_file, log_path)
        log_file.write(replace_date(line, flavour))

    log_file.close()

    if hasattr(test, "OVERRUN"):
        print(f"  Waiting {test.OVERRUN}s for overrun")
        sleep(test.OVERRUN)

    print(f"  Waiting 5s for cutting")
    sleep(5)

    if hasattr(test, "OUTPUT"):
        print(f"  Checking most recent MP4 contains {test.OUTPUT}")
        check_latest_mp4_contains(test.OUTPUT)

    if hasattr(test, "BOSSES"):
        print(f"  Check run contains {test.BOSSES} bosses")
        check_boss_count(test.BOSSES)

    print("  PASSED")


def run_retail():
    """Run all the retail tests."""
    for test in RETAIL_TESTS:
        run_test("retail", test)


def run_classic():
    """Run all the classic tests."""
    for test in CLASSIC_TESTS:
        run_test("classic", test)


def run_era():
    """Run all the classic era tests."""
    for test in ERA_TESTS:
        run_test("era", test)

def run_ptr():
    """Run all the retail ptr tests."""
    for test in PTR_TESTS:
        run_test("ptr", test)

def run_all():
    """Run all the tests."""
    run_retail()
    run_classic()
    run_era()
    run_ptr()


def run_single(flavour, test_name):
    """Run a single test, by test name."""
    test = find_test_by_name(flavour, test_name)
    run_test(flavour, test)


if args.t and args.f:
    run_single(args.f, args.t)
elif args.t and not args.f:
    print("Must specify flavour when specifying test")
    sys.exit(1)
elif not args.t and args.f == "retail":
    run_retail()
elif not args.t and args.f == "classic":
    run_classic()
elif not args.t and args.f == "era":
    run_era()
elif not args.t and args.f == "ptr":
    run_ptr()
else:
    run_all()
