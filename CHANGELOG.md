# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
### Changed
### Fixed
- [Issue 78](https://github.com/aza547/wow-recorder/issues/78) - Gracefully fail if a video can't be deleted, rather than giving an uncaught exception error
- [Issue 86](https://github.com/aza547/wow-recorder/issues/86) - Fix an event listener leak.
- Fixed memory leak in EventEmitter attachment of listener for 'updateStatus'
- [Issue 17](https://github.com/aza547/wow-recorder/issues/17) - Allow the selection of input/output audio devices for recording in settings

## [2.6.1] - 2022-09-05
### Fixed
- [Issue 70](https://github.com/aza547/wow-recorder/issues/70) - Double clicking test button no longer breaks the test.
- [Issue 77](https://github.com/aza547/wow-recorder/issues/77) - Don't expect hyphen in WoWCombatLog.txt. 
- [Issue 82](https://github.com/aza547/wow-recorder/issues/82) - Don't fall over if a 5v5 wargame recording is made.
- Update various NPM packages to resolve various dependabot security issues.

## [2.6.0] - 2022-08-29
### Added
- [Issue 50](https://github.com/aza547/wow-recorder/issues/50) - Add some plumbing for future when we support classic.
- [Issue 2](https://github.com/aza547/wow-recorder/issues/2) - Add a monitor selection config option. Defaults to first monitor.
- [Issue 9](https://github.com/aza547/wow-recorder/issues/9) - Add a test button to the GUI. 

### Changed
- Assert that OBS behaves as expected or crash the app, previously we would just continue and get into god knows what error states.  
- No longer require the application to be restarted on a config change.
- Take OSN `0.22.10`, previously was on `0.10.10`.

### Fixed
- Rename window from "Arena Recorder" to "Warcraft Recorder". 
- [Issue 23](https://github.com/aza547/wow-recorder/issues/23) - Fix clean-up buffer issue on app close. 
- [Issue 64](https://github.com/aza547/wow-recorder/issues/64), [Issue 60](https://github.com/aza547/wow-recorder/issues/60) - Overhaul async logic causing problems. 
- [Issue 54](https://github.com/aza547/wow-recorder/issues/54) - Fix to stop recording when leaving arena games with /afk. 
- [Issue 23](https://github.com/aza547/wow-recorder/issues/23) - Fix bug where app would fail to start if there were no logs in the WoW logs directory. 
- [Issue 69](https://github.com/aza547/wow-recorder/issues/69) - Fix cleanup buffer JS error. 

## [2.5.2] - 2022-08-29
### Fixed
- Fix issue where ZONE_CHANGE can crash the app.

## [2.5.1] - 2022-08-29
### Fixed
- Fix ID for Sun King's Salvation encounter.
- Fix resolution hardcoded regression. 
- Fix issue where raid encounters don't save the result correctly if quickly followed by a zone change. 

## [2.5.0] - 2022-08-29
### Added
- [Issue 29](https://github.com/aza547/wow-recorder/issues/29) - Add all shadowlands raid encounters.
- [Issue 44](https://github.com/aza547/wow-recorder/issues/44) - Auto-stop recording if WoW is closed. 
- [Issue 26](https://github.com/aza547/wow-recorder/issues/26) - Buffer recording to always capture the beginning of games/encounters. 
- Add a button to open the application log path for debugging. 
- Add a link to Discord in the application.
- Small improvements improvements to tests.

### Fixed
- Clean-up handling of images, it was really messy.

## [2.4.1] - 2022-08-20
### Fixed
- Fix BG recording that was regressed in 2.4.0. 
- Fix Warsong Gulch zone ID.

## [2.4.0] - 2022-08-20
### Added
- Write more useful information to metadata files, including player name and spec. Thanks again to ericlytle for the contribution. 
- [Issue 19](https://github.com/aza547/wow-recorder/issues/19) - Display spec and name on arena and raid videos. 
- MMR hover text for arenas.

### Changed
- Remove hardcoded aspect ratio of application only appropriate for 1080p recordings. 

### Fixed
- [Issue 40](https://github.com/aza547/wow-recorder/issues/40) - Fix to AMD AMF encoder. 
- [Issue 42](https://github.com/aza547/wow-recorder/issues/42) - Fix to Deepwind Gorge button image.
- [Issue 42](https://github.com/aza547/wow-recorder/issues/42) - Fix issue where internal BG zone changes stop the recording.

## [2.3.0] - 2022-08-14
### Added
- Resources directory and better test scripts, although they still suck.
- [Issue 10](https://github.com/aza547/wow-recorder/issues/10) - Add logging infrastructure. 
- [Issue 33](https://github.com/aza547/wow-recorder/issues/33) - Add tray icon and menu. Make minimizing now hide in system tray.
- [Issue 32](https://github.com/aza547/wow-recorder/issues/32) - Add setting to run on start-up. 
- [Issue 6](https://github.com/aza547/wow-recorder/issues/6) - Battlegrounds is now a supported category.

### Changed
- Record at 60 FPS instead of 30. 

### Fixed
- Clean-up of react UI code. 

## [2.2.0] - 2022-08-07
### Added
- [Issue 28](https://github.com/aza547/wow-recorder/issues/28) - Add open file in system explorer option when right clicking videos.
- [Issue 28](https://github.com/aza547/wow-recorder/issues/28) - Add delete video option when right clicking videos.
- [Issue 27](https://github.com/aza547/wow-recorder/issues/27) - Add save video option when right clicking videos.

### Changed
- [Issue 37](https://github.com/aza547/wow-recorder/issues/37) - Remove bitrate cap, drastically increasing recording quality (and file size). Probably should make this configurable in the future. 

### Fixed
- [Issue 22](https://github.com/aza547/wow-recorder/issues/22) - Make app less fragile to missing metadata files. 

## [2.1.0] - 2022-08-05
### Added
- Add some color to outcome indicator. 

### Changed

### Fixed
- [Issue 5](https://github.com/aza547/wow-recorder/issues/5) - Fix arena win/loss indicator. Thanks to ericlytle for the code contribution. 

## [2.0.1] - 2022-07-31

### Fixed
- Fix minimize button.
- [Issue 21](https://github.com/aza547/wow-recorder/issues/21) - Handle people /afking out of content gracefully by stopping recording on ZONE_CHANGE for most categories.

## [2.0.0] - 2022-07-07
### Added
- Backdrops for SOFO raid bosses.

### Changed
- Use libobs for recording.
  - Removal of the python code for screen recording.
  - Removal of ffmpeg binary for screen capture. 
- Refactor of most internal logic.
- Disable BG/Mythic+ modes in the GUI for now. 

### Fixed

## [1.0.3] - 2022-07-03
### Added
- Better logs for GPU detection.

### Changed
- Move output.log to a fixed relative location. 

### Fixed
- Fix for AMD hardware encoding.

## [1.0.2] - 2022-06-28
### Changed
- Rename python.log to ffmpeg.log.
- Use hardware encoding on NVIDIA or AMD GPUs.
- Change app icon so not using the electron default. 

### Fixed
- Fix size monitor so it actually works. 

## [1.0.1] - 2022-06-26
### Fixed
- Fixed up README and CHANGELOG. 
- Remove some hardcoded paths.
- Fix bug that recorder doesn't start on a dir without logs in it.
- Create required directories in storage path if they don't exist. 
- Stop/start recorder process on config change.
- Add some extremely basic console logs for python recorder controller. 

## [1.0.0] - 2022-06-21
### Added
- Initial drop of project. 