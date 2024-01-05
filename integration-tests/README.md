# Integration Tests

These tests do the following:
- Write logs to the WoW logs folder mimicing real events.
- Time the writing of those logs with reasonable approximations at real log behaviour.
- Assert that WR records a video file if appropriate.

Requirements to run:
- Python3
- WR installed and running (either prod or dev version is fine)
- The following variables in `test.py` set appropriately for your environment:
  - `RETAIL_LOG_PATH` - Retail WoW log dir
  - `CLASSIC_LOG_PATH` - Classic WoW log dir
  - `STORAGE_PATH` - WR storage path to check for videos. 

## Adding a Test
- Add an example log under the `logs/` folder.
- Add a test definition file under the `src/flavour` folder.
- Import that into the appropriate list in `src/test.py`.

## Example Usage

All the tests:
```
PS D:\checkouts\warcraft-recorder\integration-tests> python .\src\test.py
```

Just retail:
```
PS D:\checkouts\warcraft-recorder\integration-tests> python .\src\test.py -f retail
```

A specific test:
```
PS D:\checkouts\warcraft-recorder\integration-tests> python .\src\test.py -f retail -t mythic_plus
Running retail test mythic_plus...
  Sleeping 1s on ENCOUNTER_END
  Sleeping 1s on ENCOUNTER_END
  Sleeping 1s on ENCOUNTER_END
  Sleeping 1s on ENCOUNTER_END
  Sleeping 1s on CHALLENGE_MODE_END
  Waiting 5s for overrun
  Waiting 2s for cutting
  Checking most recent MP4 contains Arcanedemon - The Azure Vault +18 (+1)
  MP4 existed as expected
  PASSED
```

Helptext:
```
PS D:\checkouts\warcraft-recorder\integration-tests> python .\src\test.py -h

usage: Warcraft Recorder Tests [-h] [-f {classic,retail}]
                               [-t {mythic_plus_drop_go,mythic_plus,raid_reset,raid_unknown_encounter,raid_wipe,rated_2v2_afk_out,rated_2v2,rated_3v3,rated_battleground,skirmish,rated_solo_shuffle,wargame_3v3,zone_changes,battleground,raid,rated_2v2,rated_2v2_double,rated_3v3,rated_5v5}]

options:
  -h, --help            show this help message and exit
  -f {classic,retail}   flavour
  -t {mythic_plus_drop_go,mythic_plus,raid_reset,raid_unknown_encounter,raid_wipe,rated_2v2_afk_out,rated_2v2,rated_3v3,rated_battleground,skirmish,rated_solo_shuffle,wargame_3v3,zone_changes,battleground,raid,rated_2v2,rated_2v2_double,rated_3v3,rated_5v5}
                        test
```
