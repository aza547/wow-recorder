# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased
### Changed
### Added
### Fixed

## [5.4.2] - 2024-06-03
### Changed
- Make shareable links readable, and website player enhancements.

## [5.4.1] - 2024-05-23
### Changed
- [Issue 502](https://github.com/aza547/wow-recorder/issues/502) - Bring back combatant search filters.

### Fixed
- More M+ timer fixes.
- Better detection of mage specs in classic.
- Ignore the desktop.ini file when running folder checks.

## [5.4.0] - 2024-05-11
### Fixed
- Fix a bug where we would re-use the same stream on a failed upload, instead of a new one.
- Fix a bug where deleting a cloud video would not trigger other clients to update.
- Make the cloud settings more responsive withb a debounce timer.
- [Issue 500](https://github.com/aza547/wow-recorder/issues/500) - Fix some M+ timers.
- [Issue 400](https://github.com/aza547/wow-recorder/issues/400) - Prevent setting a pre-existing storage or buffer path with videos in it to avoid accidental deletions.
- [Issue 499](https://github.com/aza547/wow-recorder/issues/499) - Add a button and hotkey to delete all points of view for an activity.

## [5.3.1] - 2024-05-08
### Fixed
- Improve retry handling in-case of cloud upload failure.
- Fix a bug where two copies of WR were showing in Windows.
- Allow classic beta to be accepted as a valid log path.

## [5.3.0] - 2024-05-05
### Added
- [Issue 498](https://github.com/aza547/wow-recorder/issues/498) - Allows more detailed configuration of what videos to upload.
- Use new API auth endpoint to validate we're authenticated with the cloud.
- Client-side work to match API improvements for scalability.
- Fix a server side bug where long-running uploads would fail after an hour.

### Fixed
- [Issue 497](https://github.com/aza547/wow-recorder/issues/497) - Fix a bug where the upload/download buttons would show up when config wasn't valid, and when the upload button could sometimes cause errors.

## [5.2.5] - 2024-05-02
### Fixed
- [Issue 494](https://github.com/aza547/wow-recorder/issues/494) - Fix a bug where some old videos don't upload correctly due to level/keystoneLevel confusion.
- [Issue 495](https://github.com/aza547/wow-recorder/issues/495) - Fix a bug where old videos didn't show the start time correctly.

## [5.2.4] - 2024-04-28
### Fixed
- [Issue 483](https://github.com/aza547/wow-recorder/issues/483) - Fix a bug where pull count for raid bosses reset over midnight.
- [Issue 490](https://github.com/aza547/wow-recorder/issues/490) - Fix a bug where durations over an hour would wrap.
- [Issue 489](https://github.com/aza547/wow-recorder/issues/489) - Fix a bug where videos larger than 5GB failed to upload.

## [5.2.3] - 2024-04-21
### Fixed
- Fix a bug showing M+ level with old metadata versions.

## [5.2.2] - 2024-04-21
### Changed
- Video button styling.

### Fixed
- Fix a status icon bug.

## [5.2.1] - 2024-04-21
### Fixed
- Various search bar fixes.
- Remove app updater code, it doesn't work without a certificate.

## [5.2.0] - 2024-04-20
### Changed
- Cloud size monitor now runs server side.

### Added
- Add a reconfiguring status and animation to the status icon.

### Fixed
- Max cloud storage size is now variable.
- Fix a bug where the wrong video would show on startup/category change with multipov.

## [5.1.3] - 2024-04-17
### Fixed
- Fix a deplete timer in DOTI.
- Fix a bug where we could try dereference an undefined video.
- Fix a bug where search text was retained when changing categories.

## [5.1.2] - 2024-04-16
### Fixed
- A bug where the show more button would show in error.
- A bug where the cloud size monitor would delete protected videos.

## [5.1.1] - 2024-04-14
### Fixed
- Fix a bug where hitting play/pause was slightly slow to respond.

## [5.1.0] - 2024-04-14
### Fixed
- Bring back auto-updater.

## [5.0.1] - 2024-04-14
### Fixed
- Fix the cloud size monitor so it deletes from the database.
- Fix to download button not working.

## [5.0.0] - 2024-04-13
### Changed
- Use D1 for storing cloud video state, instead of JSON files in R2.

### Fixed
- Fix to include new SOD difficulty for Sunken Temple.

## [4.1.4] - 2024-04-12
### Fixed
- Fix pull counter for cloud videos.

## [4.1.3] - 2024-04-07
### Fixed
- Improve the responsiveness of setting reconfigures by only validating what has changed.
- Make the video player resizing more responsive.
- Remove deaths from unique hashing as it seems they can vary.
- Cloud size monitor running in wrong direction & test for this.
- Significant frontend performance improvements.

## [4.1.2] - 2024-04-04
### Fixed
- Cloud size monitor running in wrong direction & add a test for this.

## [4.1.1] - 2024-04-02
### Fixed
- Fix size monitor to not stop at 1000 keys.
- Reset number of videos displayed on category change.
- Fix a leaky event listener on the video button download function.
- Improve some cloud logging.
- Reset the videos shown on changing category.

## [4.1.0] - 2024-04-01
### Changed
- Let badges go higher than 99. 

### Added
- Classic era raid support.


## [4.0.9] - 2024-04-01
### Changed
- Change the test icon to be more intiuative. 
- Order video POVs alphabetically. 
- Fix a bug where we would forget the player size.


## [4.0.8] - 2024-03-31
### Fixed
- POV styling improvements.
- Cloud access bug with hardcoded bucket name.
- Make settings scrollbar wider.
- More cloud access logging.

## [4.0.7] - 2024-03-30
### Changed
- Make the POV selection group cloud and disk videos.

## [4.0.6] - 2024-03-30
### Fixed
- Fix ripple effect on video buttons when selecting sub-buttons.
- Fix button ripple effect radius.

## [4.0.5] - 2024-03-30
### Fixed
- Fix the UI button around the download spinner. 
- Fix some margins around the video buttons.

## [4.0.4] - 2024-03-30
### Changed
- Add some borders to UI buttons.

### Fixed
- Fix a bug where special characters in character names could break some functionality.

## [4.0.3] - 2024-03-30
### Fixed
- Fix a bug where frontend resource URLs could expire and fail to load.
- Improve logging for cloud function.
- Fix video marker buttons not reacting correctly.

## [4.0.2] - 2024-03-29
### Fixed
- Fix a bug where deleteing a POV could cause a blank screen.

## [4.0.1] - 2024-03-29
### Fixed
- Fix a bug where uploads would buffer the entire file into memory.
- Fix a bug where the progress bars maths was wonky.

## [4.0.0] - 2024-03-29
### Changed
- Change the CQP values for recording, they were too high resulting in large video files.

### Added
- Add cloud storage support.

## [3.25.3] - 2024-03-05
### Fixed
- Fix a bug where we would fail to detect wow running due to fastlist missing dependencies.

## [3.25.2] - 2024-03-04
### Fixed
- [Issue 482](https://github.com/aza547/wow-recorder/issues/482) - Fix a bug where leaving a Mythic+ and re-entering would cut it wrongly.
- [Issue 317](https://github.com/aza547/wow-recorder/issues/317) - Remove dependency on tasklist.
- Bring back the avoid_negative_ts make_zero to the cut command.
- Make the selected video more obvious.

## [3.25.1] - 2024-02-26
### Fixed
- [Issue 226](https://github.com/aza547/wow-recorder/issues/226) - Fix a bug where classic arena could be tagged with the wrong category.
- [Issue 252](https://github.com/aza547/wow-recorder/issues/252) - Fix a bug where hunter's feign death would end a classic arena game early.
- [Issue 481](https://github.com/aza547/wow-recorder/issues/481) - Improve classic arena spec detection.
- Cut videos more accurately by dropping the no-negative-ts flag from the cut call to ffmpeg.
- Show durations in the UI including overrun.
- Fix the color of unidentified specs in the UI.

## [3.25.0] - 2024-02-13
### Changed
- Remove combatant specs and classes from filter queries, class and spec querys now only apply to the player.
- Restyle the video delete prompt as a dialog option.
### Added
- [Issue 421](https://github.com/aza547/wow-recorder/issues/421) - Tagging feature.
### Fixed
- [Issue 388](https://github.com/aza547/wow-recorder/issues/388) - Pause video playback on minimize to system tray.
- Prevent spellchecking on the search bar text field giving annoying squiggles.
- [Issue 434](https://github.com/aza547/wow-recorder/issues/434) - Fix abandoned/deplete marking on Mythic+ dungeons.

## [3.24.0] - 2024-02-10
### Changed
- [Issue 474](https://github.com/aza547/wow-recorder/issues/474) - Use CQP/CRF encoder modes rather than VBR.
- Removed support for ffmpeg_nvenc encoder, as jim_nvenc is always preferable.
### Added
- [Issue 475](https://github.com/aza547/wow-recorder/issues/475) - Make overrun times for raid and dungeons configurable.
### Fixed
- [Issue 478](https://github.com/aza547/wow-recorder/issues/478) - Fix an issue with config validation sometimes failing when it shouldn't.

## [3.23.2] - 2024-02-03
### Fixed
- [Issue 462](https://github.com/aza547/wow-recorder/issues/462) - Fix a bug where you could not delete the selected video.
- Fix a bug where we were using the day of the week instead of day of the month in clipped file names.

## [3.23.1] - 2024-01-27
### Changed
- Improvements to the python integration test infrastructure.
- Improvements to video player controls aesthetics and overlapping of sliders in clipping mode.

### Added
- [Issue 470](https://github.com/aza547/wow-recorder/issues/470) - Add the 5120x2160 resolution.

### Fixed
- [Issue 311](https://github.com/aza547/wow-recorder/issues/311) - Ensure there is enough disk space on application of storage config.
- [Issue 477](https://github.com/aza547/wow-recorder/issues/477) - Prevent mic showing as listening when WoW is closed.
- [Issue 476](https://github.com/aza547/wow-recorder/issues/476) - Fix some buttons getting shunted off the screen on small monitors.
- Fix a bug where month numbers in clipped file names were off by one. 

## [3.23.0] - 2023-12-30
### Added
- [Issue 463](https://github.com/aza547/wow-recorder/issues/463) - Video clipping feature, includes a rework to the video player controls and timeline markers.

### Fixed
- [Issue 459](https://github.com/aza547/wow-recorder/issues/459) - Fix a bug where we didn't respect the content type settings.

## [3.22.1] - 2023-12-17
### Added
- Add the ability to drag to resize the video player without going fullscreen. 

### Fixed
- Fix some issues with the status icon occasionally showing the wrong status.

## [3.22.0] - 2023-12-10
### Added
- Add badges to the video buttons to show how many videos in each category.
- [Issue 115](https://github.com/aza547/wow-recorder/issues/115) - Add option to suppress background microphone noise.
- [Issue 448](https://github.com/aza547/wow-recorder/issues/448) - Allow naked modifier key use as the push to talk hotkey.

### Changed
- Improve responsiveness on startup.

### Fixed
- [Issue 458](https://github.com/aza547/wow-recorder/issues/458) - Fixed a bug where videos could be cut way shorter than intended.

## [3.21.0] - 2023-12-04
### Changed
- Make the video button more concise.
- Don't include "Unknown Raid" in the video file name.

### Fixed
- [Issue 455](https://github.com/aza547/wow-recorder/issues/455) - Fix the first write of the combat log being ignored.
- [Issue 453](https://github.com/aza547/wow-recorder/issues/453) - Fix erroneously holding an audio device on app starting.
- [Issue 454](https://github.com/aza547/wow-recorder/issues/454) - Improve error handling around OBS including automatic recovery from OBS misbehaviour.
- [Issue 456](https://github.com/aza547/wow-recorder/issues/456) - Fix issue with search bar remembering query but not text.

## [3.20.2] - 2023-11-17
### Fixed
- Add missing endboss in Waycrest to avoid "undefined" showing on the video timeline.
- Make text for dungeon names a bit smaller as new dungeons have long names.

## [3.20.1] - 2023-11-14
### Fixed
- Fix some bugs with Dragonflight season 3 Mythic+ dungeons.

## [3.20.0] - 2023-11-14
### Added
- [Issue 451](https://github.com/aza547/wow-recorder/issues/451) - Add Dragonflight season 3 Mythic+ dungeons.

## [3.19.4] - 2023-11-07
### Fixed
- Fix a bug where deleting a video when the first video in a category is selected breaks things.

## [3.19.3] - 2023-11-07
### Fixed
- Fix a bug where deleting a video when the last video in a category is selected breaks things.
- [Issue 447](https://github.com/aza547/wow-recorder/issues/447) - Fix a bug where could end up in an error state after sleeping Windows/closing WoW.
- [Issue 401](https://github.com/aza547/wow-recorder/issues/401) - Fix a bug where the selected video delete button shows but doesn't work.
- Pre-emptively increase the buffer time to 15 mins in anticipation of combat log changes.

## [3.19.2] - 2023-10-23
### Fixed
- Improve rejected promise handling by removing blanket rejected promise handling.
- Revert some color format changes breaking compatiblity with some platforms/players.

## [3.19.1] - 2023-10-21
### Added
- Add a CTRL override to the delete video confirmation prompt.
- Add retail / classic queries to the search bar.

### Changed
- Improve the look of some settings while a recording is active.

### Fixed
- [Issue 446](https://github.com/aza547/wow-recorder/issues/446) - Fix to darkness in AMD encodings, and improvements for other encoders.
- [Issue 443](https://github.com/aza547/wow-recorder/issues/443) - Back out initial fix and handle F5 refresh properly.
- Fixed an issue with some encounters not working as search bar queries.
- Hide the "Unknown Raid" text to make app maintenance easier.
- Fixed issue where we tried to delete some non-existent files noisy ENOENT errors in logs.
- Improve the search bar behaviour for existing queries when new videos are recorded.

## [3.19.0] - 2023-10-03
### Added
- Add the 3840 x 1200 resolution.
- [Issue 125](https://github.com/aza547/wow-recorder/issues/125) - Push to talk for microphone recording.
- Window capture support.

### Fixed
- [Issue 443](https://github.com/aza547/wow-recorder/issues/443) - Fix to Ctrl + R breaking the app.
- Fix PTR log path validation.

## [3.18.1] - 2023-09-03
### Fixed
- [Issue 440](https://github.com/aza547/wow-recorder/issues/440) - Fix a bug preventing settings being configured for the first time.

## [3.18.0] - 2023-09-03
### Added
- [Issue 425](https://github.com/aza547/wow-recorder/issues/425) - Add death counter to the video button for raids and mythic+.

### Fixed
- [Issue 435](https://github.com/aza547/wow-recorder/issues/435) - Only allow the software encoder for resolutions over 4000 pixels.
- [Issue 437](https://github.com/aza547/wow-recorder/issues/437) - Replace some sync logic with async logic.

## [3.17.0] - 2023-08-05
### Added
- [Issue 415](https://github.com/aza547/wow-recorder/issues/415) - Add buttons for easily toggling video markers, and other video marker improvements.

### Fixed
- Fix a bug where the coloring of the video tracker bar was slightly wrong.
- Fix a bug where the app didn't remember the last selected category on starting up.

## [3.16.1] - 2023-07-28
### Fixed
- Fix a bug where if no matches found with a filter query then the app would forever show the no videos message.

## [3.16.0] - 2023-07-23
### Changed
- Revamp the UI to be more intuative.

## [3.15.2] - 2023-07-16
### Fixed
- [Issue 310](https://github.com/aza547/wow-recorder/issues/310) - React to Windows sleep events better to avoid problems on Windows waking up.
### Changed
- Start building and packaging with the latest version of NodeJS (20.4.0).

## [3.15.1] - 2023-07-12
### Added
- Add the augmentation spec for evokers.

## [3.15.0] - 2023-07-08
### Added
- [Issue 407](https://github.com/aza547/wow-recorder/issues/407) - Record unrecognised encounters. This will enable WR to record legacy, beta and ptr raid bosses.
- [Issue 428](https://github.com/aza547/wow-recorder/issues/428) - Add a daily pull counter to raid video buttons.

### Changed
- Improve home page aesthetics.
- [Issue 427](https://github.com/aza547/wow-recorder/issues/427) - Include the player name in the video file name.

### Fixed
- Fix category selection chip which would do nothing when used on the settings/scene editor pages.
- Default max storage to zero (unlimited) instead of 200GB.

## [3.14.2] - 2023-06-24
### Added
- Add encounters for Trial of the Crusader classic. 

## [3.14.1] - 2023-06-21
### Fixed
- Revert the version of OBS studio node to 0.23.71 as the upgrade cause a bug preventing the chat overlay from showing.

## [3.14.0] - 2023-06-20
### Added
- [Issue 423](https://github.com/aza547/wow-recorder/issues/423) - Add affixes and some other UI improvements.
- [Issue 353](https://github.com/aza547/wow-recorder/issues/353) - Add overrun icon to the status indicator.

### Changed
- Bump the version of OBS studio node to 0.23.82.

## [3.13.1] - 2023-06-04
### Changed
- [Issue 416](https://github.com/aza547/wow-recorder/issues/416) - Automatically scale to canvas size.
- [Issue 420](https://github.com/aza547/wow-recorder/issues/420) - Convert to using thumbnails instead of fixed images.

### Fixed
- [Issue 417](https://github.com/aza547/wow-recorder/issues/417) - Fix a bug where sometimes recordings were missed.
- Split out the chat overlay settings from the game settings so it's more responsive.
- [Issue 418](https://github.com/aza547/wow-recorder/issues/418) - Improve the test button UX.
- [Issue 419](https://github.com/aza547/wow-recorder/issues/419) - Fix some misnamed boss encounters.

## [3.13.0] - 2023-05-21
### Added
- [Issue 216](https://github.com/aza547/wow-recorder/issues/216) - Add volume controls for audio sources.

### Changed
- [Issue 404](https://github.com/aza547/wow-recorder/issues/404) - Revamp settings so they can be configured live.
- [Issue 406](https://github.com/aza547/wow-recorder/issues/406) - Show death markers in all content types.

### Fixed
- [Issue 387](https://github.com/aza547/wow-recorder/issues/387) - Fix to Mythic+ video markers UX.
- [Issue 395](https://github.com/aza547/wow-recorder/issues/395) - Fix Dragonflight S2 dungeon timings for +2 and +3 chests.
- [Issue 405](https://github.com/aza547/wow-recorder/issues/405) - Guard against setting retail and classic log path to the same value.
- [Issue 410](https://github.com/aza547/wow-recorder/issues/410) - Fix preview dissapearing if recording while player is fullscreen.
- [Issue 393](https://github.com/aza547/wow-recorder/issues/393) - Improve some clipping issues with the preview. 

## [3.12.0] - 2023-05-03
### Added
- [Issue 386](https://github.com/aza547/wow-recorder/issues/386) - Option to disable minimize to tray.
- [Issue 394](https://github.com/aza547/wow-recorder/issues/394) - Updates for Dragonflight season 2 content.

### Fixed
- [Issue 397](https://github.com/aza547/wow-recorder/issues/397) - Fix issue where scene preview may not position correctly.

## [3.11.0] - 2023-04-30
### Added
- [Issue 354](https://github.com/aza547/wow-recorder/issues/354) - Add a scene preview to the home page.
- [Issue 354](https://github.com/aza547/wow-recorder/issues/354) - Add a scene editor page.
- [Issue 46](https://github.com/aza547/wow-recorder/issues/46) - Add the ability to use a chat overlay.

### Changed
- Restyle some checkboxes in the settings as switches, for continuity. 

### Fixed
- [Issue 384](https://github.com/aza547/wow-recorder/issues/384) - Fix Balakar Khan encounter ID.
- [Issue 391](https://github.com/aza547/wow-recorder/issues/391) - Bump electron version to ^24.0.0 to fix Mexico timezone bug.

## [3.10.4] - 2023-04-26
### Added
- [Issue 381](https://github.com/aza547/wow-recorder/issues/381) - Add "bookmarked" as a filter option.

### Fixed
- [Issue 381](https://github.com/aza547/wow-recorder/issues/381) - Fix a bug where the search bar query isn't cleared.
- [Issue 383](https://github.com/aza547/wow-recorder/issues/383) - Remove some options from the installer that didn't work. 
- [Issue 382](https://github.com/aza547/wow-recorder/issues/383) - Fix a bug where toggling bookmark on a video could make it vanish from the UI.

## [3.10.3] - 2023-04-24
### Fixed
- [Issue 328](https://github.com/aza547/wow-recorder/issues/328) - Fix a bug where the installer didn't automatically install the Visual C++ Redistributable package from Microsoft.

## [3.10.2] - 2023-04-23
### Changed
- [Issue 370](https://github.com/aza547/wow-recorder/issues/370) - Show more than the most recent video on home page.
- [Issue 371](https://github.com/aza547/wow-recorder/issues/371) - Include Battleground names in the UI.
- [Issue 352](https://github.com/aza547/wow-recorder/issues/352) - Change the home page to be less fancy and more functional.
- [Issue 359](https://github.com/aza547/wow-recorder/issues/359) - Add lots of support querys to the filter bar.
- [Issue 366](https://github.com/aza547/wow-recorder/issues/366) - Delete button now has a confirmation prompt.

### Fixed
- [Issue 376](https://github.com/aza547/wow-recorder/issues/376) - Change seeking so clicking a video marker won't go to the start but to where the user clicked.

## [3.10.1] - 2023-04-11
### Fixed
- [Issue 373](https://github.com/aza547/wow-recorder/issues/373) - Fixed an issue where the Mythic+ UI didn't display correctly due to combatant bleed.
- [Issue 372](https://github.com/aza547/wow-recorder/issues/372) - Improve the help text next to the force stop button.

## [3.10.0] - 2023-04-10
### Added
- [Issue 358](https://github.com/aza547/wow-recorder/issues/358) - Option to set threshold for raid difficulty recordings.
- [Issue 177](https://github.com/aza547/wow-recorder/issues/177) - Allow picking a category when using the test button.
- [Issue 359](https://github.com/aza547/wow-recorder/issues/359) - Add a search bar for filtering videos.

### Changed
- [Issue 352](https://github.com/aza547/wow-recorder/issues/352) - Improvements to the home page aesthetics.
- [Issue 347](https://github.com/aza547/wow-recorder/issues/347) - Only overrun in raids on kills.

### Fixed
- [Issue 355](https://github.com/aza547/wow-recorder/issues/355) - Fixed an issue where swapping characters can confuse the parser.
- [Issue 355](https://github.com/aza547/wow-recorder/issues/355) - Fixed an issue where we were incorrectly marking abandoned M+ as completed.
- [Issue 356](https://github.com/aza547/wow-recorder/issues/356) - Fixed an issue where adding too many audio devices wasn't handled well.
- [Issue 365](https://github.com/aza547/wow-recorder/issues/365) - Fixed an issue where an unknown specID would crash the app.
- [Issue 367](https://github.com/aza547/wow-recorder/issues/367) - Fixed an issue where Mythic+ COMBATANT_INFO events weren't getting handled appropriately. 
- [Issue 368](https://github.com/aza547/wow-recorder/issues/368) - Fixed an issue where comps don't display correctly in some retail content.

## [3.9.0] - 2023-04-07
### Added
- [Issue 334](https://github.com/aza547/wow-recorder/issues/334) - Add JKL, arrows and space hotkeys to video player for seeking.

### Changed
- [Issue 352](https://github.com/aza547/wow-recorder/issues/352) - Improvements to the home page aesthetics.
- Adjusted M+ markers to be based on segment duration.
- Adjusted M+ marker mouseover tips to be boss names instead of just 'Boss'.

### Fixed
- [NO-ISSUE] Fixed a bug where the app would sometimes crash on selecting a category with no videos.
- [Issue 362](https://github.com/aza547/wow-recorder/issues/362) - Include the M+ keystone level in the GUI. 

## [3.8.0] - 2023-04-04
### Changed
- [Issue 352](https://github.com/aza547/wow-recorder/issues/352) - Totally redesign the user interface.
- [Issue 348](https://github.com/aza547/wow-recorder/issues/348) - Changed CSS for Seek Bar to make it taller.

### Fixed
- [Issue 350](https://github.com/aza547/wow-recorder/issues/350) - Fix a bug where videos could be cut wrongly after using the stop recording button.
- Corrected first boss name in Court of Stars.
- [Issue 144](https://github.com/aza547/wow-recorder/issues/144) - Hide markers for some categories/flavours.

## [3.7.0] - 2023-03-24
### Added
- [Issue 340](https://github.com/aza547/wow-recorder/issues/340) - Option to minimize on clicking quit button.
- [Issue 144](https://github.com/aza547/wow-recorder/issues/144) - Add video timeline markers for solo shuffle and mythic+.
- [NO-ISSUE](https://github.com/aza547/wow-recorder/issues/144) - Add 5120x1440 resolution.

### Changed
- [Issue 144](https://github.com/aza547/wow-recorder/issues/144) - Use the Video JS player for playback.

### Fixed
- [Issue 334](https://github.com/aza547/wow-recorder/issues/344) - Fix bitrate for AMD GPUs, signficantly improving video quality.
- [Issue 334](https://github.com/aza547/wow-recorder/issues/344) - Remove some unsupported encoders.

## [3.6.2] - 2023-03-12
### Changed
- [NO-ISSUE] Upgrade OSN from 0.23.59 to 0.23.71. 
### Fixed
- [Issue 287](https://github.com/aza547/wow-recorder/issues/287) - Fix some ugly icons to look better. 
- [Issue 325](https://github.com/aza547/wow-recorder/issues/325) - Fix the OBS process not closing correctly on quitting.
- [Issue 338](https://github.com/aza547/wow-recorder/issues/338) - Resolve a problem when upgrading the app wouldn't shutdown OBS. 

## [3.6.1] - 2023-03-08
### Fixed
- [Issue 332](https://github.com/aza547/wow-recorder/issues/332) - Disable hardware accelerated rendering of the app.
- [Issue 336](https://github.com/aza547/wow-recorder/issues/336) - Fix a bug where we sometimes didn't refresh the GUI after a video was recorded. 
- [Issue 337](https://github.com/aza547/wow-recorder/issues/337) - Fix a spammy log if there is an empty WoW log dir. 

## [3.6.0] - 2023-03-04
### Added
- [Issue 329](https://github.com/aza547/wow-recorder/issues/329) - Option to hide cursor. 
- [Issue 326](https://github.com/aza547/wow-recorder/issues/326) - Option to ignore M+ below a certain level.

### Fixed
- [Issue 323](https://github.com/aza547/wow-recorder/issues/329) - Fix bug where size monitor was deleting protected videos.

## [3.5.1] - 2023-02-07
### Fixed
- [Issue 321](https://github.com/aza547/wow-recorder/issues/321) - Fix so that bitrate settings are remembered after first recording.

## [3.5.0] - 2023-02-03
### Added
- [Issue 34](https://github.com/aza547/wow-recorder/issues/34) - Add unit test infrastructure.
- [Issue 312](https://github.com/aza547/wow-recorder/issues/312) - Add a bookmark icon for protected videos.

### Changed
- [Issue 272](https://github.com/aza547/wow-recorder/issues/272) - Revert request for elevated permissions preventing running on startup. 

### Fixed
- [Issue 293](https://github.com/aza547/wow-recorder/issues/293) - Fix a backend bug where reconfiguring would leak audio device references.
- [Issue 303](https://github.com/aza547/wow-recorder/issues/303) - Fix error handling so that we don't get a blank screen if something goes wrong.
- [Issue 291](https://github.com/aza547/wow-recorder/issues/291) - Improve activity and recorder logic to prevent classic double stop issue. 
- [Issue 314](https://github.com/aza547/wow-recorder/issues/314) - Make size monitor more async to avoid app lag on game ending.

## [3.4.0] - 2023-01-22
### Added
- [Issue 296](https://github.com/aza547/wow-recorder/issues/296) - Add Ulduar classic support.
- [Issue 300](https://github.com/aza547/wow-recorder/issues/300) - Add difficulty to raid file names.

### Fixed
- [Issue 285](https://github.com/aza547/wow-recorder/issues/285) - Fix bug that prevented retail recording of retail war games. 
- [Issue 288](https://github.com/aza547/wow-recorder/issues/288) - Fix bug that prevented changing the FPS setting.
- [Issue 275](https://github.com/aza547/wow-recorder/issues/275) - Increase retail log timeout for better handling of M+.
- [Issue 251](https://github.com/aza547/wow-recorder/issues/251) - Fix text overflow clipping in video selection buttons.
- [Issue 293](https://github.com/aza547/wow-recorder/issues/293) - Fix to prevent adding too many audio devices in the settings.
- [Issue 294](https://github.com/aza547/wow-recorder/issues/294) - Remove a bunch of encoders that don't work with WR. 

## [3.3.3] - 2023-01-14
### Fixed
- Fix a bug where we didn't respect the overrun.
- [Issue 279](https://github.com/aza547/wow-recorder/issues/279) - Improve signalling robustness.
- [Issue 276](https://github.com/aza547/wow-recorder/issues/276) - Reconfiguring settings doesn't result in a blank screen with game capture.
- [Issue 280](https://github.com/aza547/wow-recorder/issues/280) - Handle unplugged audio devices better in the config.

## [3.3.2] - 2023-01-08
### Fixed
- [Issue 273](https://github.com/aza547/wow-recorder/issues/273) - Fix a bug where raid resets could crash the app.
- [Issue 271](https://github.com/aza547/wow-recorder/issues/271) - Allow OBS more time to signal.
- [Issue 274](https://github.com/aza547/wow-recorder/issues/274) - Fix bug when sometimes an internal arena zone change would crash the app.

## [3.3.1] - 2023-01-02
### Fixed
- [NO-ISSUE]- Fix crass default resolution bug.

## [3.3.0] - 2023-01-01
### Added
- [Issue 245](https://github.com/aza547/wow-recorder/issues/245) - Ability to pick and chose any combination of audio devices to record.

### Changed
- Upgrade obs-studio-node to 0.23.59. 

### Fixed
- [Issue 264](https://github.com/aza547/wow-recorder/issues/264) - Attempt to fix some permissions problems on Windows 11.
- [Issue 223](https://github.com/aza547/wow-recorder/issues/223) - Make resolutions hardcoded so there can be no weird disappearing of options. 
- [Issue 256](https://github.com/aza547/wow-recorder/issues/256) - Fix bug where resolution was sometimes flipped. 
- [Issue 57](https://github.com/aza547/wow-recorder/issues/57) - Fix a bug preventing windows from sleeping with WR open. 

## [3.2.0] - 2022-12-23
### Added
- [Issue 247](https://github.com/aza547/wow-recorder/issues/247) - Better handling for Solo Shuffle.

### Fixed
- [Issue 257](https://github.com/aza547/wow-recorder/issues/257) - Improve right click menu responsiveness. 

## [3.1.2] - 2022-12-17
### Added
- [Issue 246](https://github.com/aza547/wow-recorder/issues/246) - Config check that storage path and buffer path are different.
- [Issue 282](https://github.com/aza547/wow-recorder/issues/282) - Added config toggle switch to force input audio to mono.

### Changed
- Autoplay videos on selection.
- Display errors in a neater manner with suggestions on how to get help.
- Improve clipping of classic arenas to skip waiting room.

### Fixed
- Fix a bug where closing wow didn't stop the recorder if mid activity.
- Fix a problem when saving videos to NFS mounts. 
- [Issue 187](https://github.com/aza547/wow-recorder/issues/187) - Add Dragonflight M+ timings.

## [3.1.1] - 2022-12-09
### Fixed
- [Issue 239](https://github.com/aza547/wow-recorder/issues/239) - Fix app crashing when WoW closes if both log paths (retail and classic) are not configured. 
- [Issue 238](https://github.com/aza547/wow-recorder/issues/238) - Don't crash on unrecognised video category, just don't record.
- Fix to log watching to make the UI more responsive.
- Fix Nokhun Proving Grounds image and shorten name.
- Update video poster to look better.

## [3.1.0] - 2022-12-03
### Added
- [Issue 187](https://github.com/aza547/wow-recorder/issues/187) - Added the new M+ dungeons and arena for Dragonflight S1.
- [Issue 237](https://github.com/aza547/wow-recorder/issues/237) - Show specifically what config is wrong when config is invalid. 

### Fixed
- [Issue 236](https://github.com/aza547/wow-recorder/issues/236) - Fix to ignore normal, heroic and m0 dungeon bosses, as well as unknown encounters.  

## [3.0.4] - 2022-11-27
### Fixed
- [Issue 235](https://github.com/aza547/wow-recorder/issues/235) - Fix a bug where abandoned M+ runs caused the app to crash. 
- [Issue 229](https://github.com/aza547/wow-recorder/issues/229) - Fix a bug where the test button didn't work without a retail log path configured.
- Fix a bug where closing WoW while in an activity could crash the app.

## [3.0.3] - 2022-11-24
### Fixed
- Fix a bug where overrun isn't working as intended. Broke this in 3.0.1.

## [3.0.2] - 2022-11-20
### Fixed
- Fix a bug where videos were sometimes cut to wrong sizes.
- Fix a bug where Evoker class color wasn't displayed in the UI. 

## [3.0.1] - 2022-11-14
### Changed
- [Issue 228](https://github.com/aza547/wow-recorder/issues/228) - Clip activities better by not assuming buffer time is end of video.

### Fixed
- [Issue 224](https://github.com/aza547/wow-recorder/issues/224) - Make settings window taller to avoid clipping content settings.
- [Issue 230](https://github.com/aza547/wow-recorder/issues/230) - Fix a bug where recordings after saving settings were broken. 

## [3.0.0] - 2022-11-12

### Added
- [Issue 50](https://github.com/aza547/wow-recorder/issues/50) - Classic arena and battleground support. 
- Functionality to have a good estimate at if a battleground is a win or loss.
- Spec detection for all categories that lacked it. 
- Initial Evoker class handling in preperation for Dragonflight.

### Changed
- [Issue 224](https://github.com/aza547/wow-recorder/issues/224) - Improve main window styling. Bbreaks backwards compatbility with previously recorded videos.

### Fixed
- [Issue 221](https://github.com/aza547/wow-recorder/issues/221) - Fix a bug where on some setups only a subsection of the game was recorded. 

## [2.10.2] - 2022-11-04
### Fixed
- [Issue 220](https://github.com/aza547/wow-recorder/issues/220) - Revert audio sources muting to fix black screen recording bug. 

## [2.10.1] - 2022-11-02
### Fixed
- [Issue 57](https://github.com/aza547/wow-recorder/issues/57) - Only enable audio sources when recording buffer to avoid Windows not being able to go into sleep mode.
- [Issue 218](https://github.com/aza547/wow-recorder/issues/218) - Fix solo shuffle on DF pre-patch.

## [2.10.0] - 2022-10-22
### Added
- [Issue 211](https://github.com/aza547/wow-recorder/issues/211) - Validate combat log paths to avoid mistakes.
- [Issue 2](https://github.com/aza547/wow-recorder/issues/2) - Add Game Capture mode.
- [Issue 207](https://github.com/aza547/wow-recorder/issues/207) - Suggest some bitrates in the settings help text.

### Fixed
- [Issue 168](https://github.com/aza547/wow-recorder/issues/168) - Fix player combatant not being saved properly when a recording is forcibly ended.
- [Issue 205](https://github.com/aza547/wow-recorder/issues/205) - Expose encoder in Advanced Settings.
- [Issue 206](https://github.com/aza547/wow-recorder/issues/206) - Bitrate label corrected say to Mbps. 
- [Issue 208](https://github.com/aza547/wow-recorder/issues/208) - Fix to Warsong Gulch image.
- [Issue 213](https://github.com/aza547/wow-recorder/issues/213) - Fix the application occasionally crashing when WoW is closed.

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
