# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- [Issue 2](https://github.com/aza547/wow-recorder/issues/2) - Add Game Capture mode
- [Issue 207](https://github.com/aza547/wow-recorder/issues/207) - Suggest some bitrates in the settings help text.

### Changed
### Fixed
- [Issue 168](https://github.com/aza547/wow-recorder/issues/168) - Fix player combatant not being saved properly when a recording is forcibly ended.
- [Issue 206](https://github.com/aza547/wow-recorder/issues/206) - Bitrate label corrected say to Mbps. 
- [Issue 208](https://github.com/aza547/wow-recorder/issues/208) - Fix to Warsong Gulch image.

## [2.9.0] - 2022-10-11
### Added
- [Issue 50](https://github.com/aza547/wow-recorder/issues/50) - Add WOTLK classic raid support for Naxx, EOE, OS and VOA. 
- [Issue 191](https://github.com/aza547/wow-recorder/issues/191) - Recording FPS, output resolution, and video bit rate now adjustable in video settings.
- [Issue 187](https://github.com/aza547/wow-recorder/issues/187) - Added Vault of the Incarnates raid IDs. 
- [Issue 192](https://github.com/aza547/wow-recorder/issues/192) - Accept Beta, PTR and classic processes as reason to move to ready state. 

### Changed
- [Issue 194](https://github.com/aza547/wow-recorder/issues/194) - Change to variable bitrate recording. This will drastically reduce video sizes. 


### Fixed
- [Issue 194](https://github.com/aza547/wow-recorder/issues/194) - Cut videos in a queue and don't block the recorder.
- [Issue 193](https://github.com/aza547/wow-recorder/issues/193) - Add some guards so we don't start recording in an invalid state. 
- [Issue 199](https://github.com/aza547/wow-recorder/issues/199) - Fix a bug where clicking test button several times would do bad things. 

## [2.8.2] - 2022-10-02

### Added
- [Issue 184](https://github.com/aza547/wow-recorder/issues/184) - Option to start-up to the system tray.

### Fixed 
- [Issue 164](https://github.com/aza547/wow-recorder/issues/164) - Expose the settings help text in the UI.
- [Issue 178](https://github.com/aza547/wow-recorder/issues/178) - Fix bufferStoragePath defaulting to an empty string.
- [Issue 186](https://github.com/aza547/wow-recorder/issues/186) - Prevent running multiple copies of WR. 

## [2.8.1] - 2022-09-27
### Fixed
- [Issue 175](https://github.com/aza547/wow-recorder/issues/175) - Fix test button on non en-GB locales. 
- [Issue 176](https://github.com/aza547/wow-recorder/issues/176) - Fix app crashing when recording is force stopped. 
- [Issue 177](https://github.com/aza547/wow-recorder/issues/177) - Let test run regardless of 2v2 config setting.

## [2.8.0] - 2022-09-26
### Added
- [Issue 81](https://github.com/aza547/wow-recorder/issues/81) - Better monitor selection in settings UI.
- [Issue 52](https://github.com/aza547/wow-recorder/issues/52) - Video files are now named more human friendly.
- [Issue 134](https://github.com/aza547/wow-recorder/issues/134) - Only handle UNIT_DIED when a recording activity is in progress.
- [Issue 142](https://github.com/aza547/wow-recorder/issues/142) - Make it possible to stop recording by clicking the 'rec' icon.
- [Issue 166](https://github.com/aza547/wow-recorder/issues/166) - Remember the selected category across application restarts.
- [Issue 150](https://github.com/aza547/wow-recorder/issues/50) - Add infrastructure for future classic support.
- [Issue 168](https://github.com/aza547/wow-recorder/issues/168) - Add a timeout feature that will end a recording after 2 minutes of combatlog inactivity. 

### Changed
- [Issue 165](https://github.com/aza547/wow-recorder/issues/165) - Now loads videos asynchronously to improve application reponsiveness on start up with many videos.
- [Issue 164](https://github.com/aza547/wow-recorder/issues/164) - Entirely revamp the settings to be more responsive and modern. Will reset user settings.

### Fixed
- [Issue 124](https://github.com/aza547/wow-recorder/issues/234) - Make buffering dir configurable. This setting is optional and will sensibly default.
- [Issue 123](https://github.com/aza547/wow-recorder/issues/123) - More robust monitor selection.
- [Issue 128](https://github.com/aza547/wow-recorder/issues/128) - Guard against multiple recording buffer restarts.
- [Issue 130](https://github.com/aza547/wow-recorder/issues/130) - Fix invalid default audio input/output device.
- [Issue 139](https://github.com/aza547/wow-recorder/issues/139) - Give OBS longer to recover, but crash the app if it doesn't signal.
- [Issue 155](https://github.com/aza547/wow-recorder/issues/155) - Fix periodic lag spike every 1 second while using app. 
- [Issue 167](https://github.com/aza547/wow-recorder/issues/167) - Fix Iron Docks M+ timer. 
- [Issue 133](https://github.com/aza547/wow-recorder/pull/133) - Fix bug that audio device would sometimes record when set to none. 

## [2.7.0] - 2022-09-19
### Added
- [Issue 47](https://github.com/aza547/wow-recorder/issues/48) - Add Mythic+ recording support.
- [Issue 74](https://github.com/aza547/wow-recorder/issues/74) - Added version check from github releases page.
- [Issue 99](https://github.com/aza547/wow-recorder/issues/99) - Remember video sound settings when changing videos.
- [Issue 107](https://github.com/aza547/wow-recorder/issues/107) - Add a config setting for minimum raid duration, to avoid saving boss resets. 
- [Issue 17](https://github.com/aza547/wow-recorder/issues/17) - Allow the selection of input/output audio devices for recording in settings.

### Changed
- [Issue 66](https://github.com/aza547/wow-recorder/issues/66) - Store buffer recordings in a better location. 

### Fixed
- [Issue 96](https://github.com/aza547/wow-recorder/issues/96) - Fixed windows resolution scaling resulting in OBS Resolutions not being set properly.
- [Issue 78](https://github.com/aza547/wow-recorder/issues/78) - Gracefully fail if a video can't be deleted, rather than giving an uncaught exception error.
- [Issue 75](https://github.com/aza547/wow-recorder/issues/75) - Fix to size monitor blocking saving of videos.
- [Issue 86](https://github.com/aza547/wow-recorder/issues/86) - Fix various event listener leaks.
- [Issue 112](https://github.com/aza547/wow-recorder/issues/112) - Crash the app if OBS gets into a bad state. 

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
