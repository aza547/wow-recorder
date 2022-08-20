# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [2.4.0] - 2022-08-20
### Added
- Write more useful information to metadata files, including player name and spec. Thanks again to ericlytle for the contribution. 
- [19](https://github.com/aza547/wow-recorder/issues/19) Display spec and name on arena and raid videos. 
- MMR hover text for arenas.

### Changed
- Remove hardcoded aspect ratio of application only appropriate for 1080p recordings. 

### Fixed
- [40](https://github.com/aza547/wow-recorder/issues/40) - Fix to AMD AMF encoder. 
- [42](https://github.com/aza547/wow-recorder/issues/42) - Fix to Deepwind Gorge button image.
- [42](https://github.com/aza547/wow-recorder/issues/42) - Fix issue where internal BG zone changes stop the recording.

## [2.3.0] - 2022-08-14
### Added
- Resources directory and better test scripts, although they still suck.
- [10](https://github.com/aza547/wow-recorder/issues/10) - Add logging infrastructure. 
- [33](https://github.com/aza547/wow-recorder/issues/33) - Add tray icon and menu. Make minimizing now hide in system tray.
- [32](https://github.com/aza547/wow-recorder/issues/32) - Add setting to run on start-up. 
- [6](https://github.com/aza547/wow-recorder/issues/6) - Battlegrounds is now a supported category.

### Changed
- Record at 60 FPS instead of 30. 

### Fixed
- Clean-up of react UI code. 

## [2.2.0] - 2022-08-07
### Added
- [28](https://github.com/aza547/wow-recorder/issues/28) - Add open file in system explorer option when right clicking videos.
- [28](https://github.com/aza547/wow-recorder/issues/28) - Add delete video option when right clicking videos.
- [27](https://github.com/aza547/wow-recorder/issues/27) - Add save video option when right clicking videos.

### Changed
- [37](https://github.com/aza547/wow-recorder/issues/37) - Remove bitrate cap, drastically increasing recording quality (and file size). Probably should make this configurable in the future. 

### Fixed
- [22](https://github.com/aza547/wow-recorder/issues/22) - Make app less fragile to missing metadata files. 

## [2.1.0] - 2022-08-05
### Added
- Add some color to outcome indicator. 

### Changed

### Fixed
- [5](https://github.com/aza547/wow-recorder/issues/5) - Fix arena win/loss indicator. Thanks to ericlytle for the code contribution. 

## [2.0.1] - 2022-07-31

### Fixed
- Fix minimize button.
- [21](https://github.com/aza547/wow-recorder/issues/21) - Handle people /afking out of content gracefully by stopping recording on ZONE_CHANGE for most categories.

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