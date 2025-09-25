# Warcraft Recorder
![GitHub all releases](https://img.shields.io/github/downloads/aza547/wow-recorder/total)
![Version](https://img.shields.io/github/package-json/v/aza547/wow-recorder?filename=release%2Fapp%2Fpackage.json)
![Discord](https://img.shields.io/discord/1004860808737591326)

Warcraft Recorder is a desktop screen recorder. It watches the WoW combat log file for interesting events, records them, and presents a user interface in which the recordings can be viewed. 

![](https://i.imgur.com/dqRIzAt.png)

#  How to Use
1. Download and run the most recent [Warcraft Recorder installer](https://github.com/aza547/wow-recorder/releases/latest).
2. Launch the application and click the Settings button.
    - Create a folder on your PC to store the recordings.
    - Set the Storage Path to the folder you just created.
    - Enable recording and set the location of your World of Warcraft logs folder.
    - Modify any other settings as desired.
3. Click the Scene button and configure the OBS scene and recording settings.
    - Select your desired output resolution.
    - Add your speakers and/or microphone if you want to include audio.
    - Recommend selecting a hardware encoder, if available.
    - Modify any other settings as desired.
5. Install the required combat logging addon, enabling advanced combat logging when prompted.
    - Retail: SimpleCombatLogger ([CurseForge](https://www.curseforge.com/wow/addons/simplecombatlogger), [Wago](https://addons.wago.io/addons/simplecombatlogger)).
    - Classic: AutoCombatLogger ([CurseForge](https://www.curseforge.com/wow/addons/autocombatlogger), [Wago](https://addons.wago.io/addons/autocombatlogger)). 
    - Classic Era: AutoCombatLogger ([CurseForge](https://www.curseforge.com/wow/addons/autocombatlogger), [Wago](https://addons.wago.io/addons/autocombatlogger)). 

# Supported Platforms

| OS | Support |
|---|---|
| Windows | Yes |
| Mac | No |
| Linux | No |

| Flavour | Support |
|---|---|
| Retail | Yes |
| WotLK Classic | Yes |
| Classic Era | SoD Raids Only |

# Testing It Works
You can test that Warcraft Recorder works by clicking the test icon with World of Warcraft running after you have completed the above setup steps. This runs a short test of the recording function.

![](https://i.imgur.com/RJcMPNI.png)

# Bug Reports & Suggestions

Please create an issue, I will get to it eventually. Bear in mind maintaining this is a hobby for me, so it may take me some time to comment. If you think you can improve something, feel free to submit a PR.

I've created a dedicated discord for this project, feel free to join [here](https://discord.gg/NPha7KdjVk).

# Contributing

If you're interested in getting involved please drop me a message on discord and I can give you access to our development channel. Also see [contributing](https://github.com/aza547/wow-recorder/blob/main/docs/CONTRIBUTING.md) docs.

# Mentions

The recording done by Warcraft Recorder is made possible by packaging up [OBS](https://obsproject.com/). We wouldn't stand a chance at providing something useful without it. Big thanks to the OBS developers.

The app is built with [Electron](https://www.electronjs.org/) and [React](https://react.dev/), using the boilerplate provided by the [ERB](https://electron-react-boilerplate.js.org/) project. 

Drawing overlay created using [Excalidraw](https://github.com/excalidraw/excalidraw).
