# Warcraft Recorder
![GitHub all releases](https://img.shields.io/github/downloads/aza547/wow-recorder/total)
![Version](https://img.shields.io/github/package-json/v/aza547/wow-recorder?filename=release%2Fapp%2Fpackage.json)
![Discord](https://img.shields.io/discord/1004860808737591326)

Warcraft Recorder is a desktop screen recorder. It watches the WoW combat log file for interesting events, records them, and presents a user interface in which the recordings can be viewed. 

![](https://i.imgur.com/Ekz8zp5.png)
![](https://i.imgur.com/wEAWCrQ.png)
![](https://i.imgur.com/is5wrH2.png)

Windows is currently the only supported operating system. 

#  How to Use
1. Download and run the most recent installer from the [releases](https://github.com/aza547/wow-recorder/releases) section.
1. Launch the application and click the settings cog, then fill out the settings page.
1. Enable combat logging.
    - Retail: Install and configure the SimpleCombatLogger addon ([CurseForge](https://www.curseforge.com/wow/addons/simplecombatlogger), [Wago](https://addons.wago.io/addons/simplecombatlogger)).
    - Classic: Install and configure the AutoCombatLogger addon ([CurseForge](https://www.curseforge.com/wow/addons/autocombatlogger), [Wago](https://addons.wago.io/addons/autocombatlogger)). 

If you are a retail arena player, I also recommend the [jaxSurrender](https://www.curseforge.com/wow/addons/jaxsurrender) addon.

# Testing It Works

You can test that Warcraft Recorder works by clicking the test icon with World of Warcraft running after you have completed the above setup steps. This runs a 10 second test of the recording functionality by mimicing a 2v2 game.

<img src="https://i.imgur.com/Nk4OCf6.png">

# Bug Reports & Suggestions

Please create an issue, I will get to it eventually. Bear in mind maintaining this is a hobby for me, so it may take me some time to comment. If you think you can improve something, feel free to submit a PR.

I've created a dedicated discord for this project, feel free to join [here](https://discord.gg/NPha7KdjVk).

# Contributing

If you're interested in getting involved please drop me a message on discord and I can give you access to our development channel. Also see [contributing](https://github.com/aza547/wow-recorder/blob/main/docs/CONTRIBUTING.md) docs.

# Mentions

The recording done by Warcraft Recorder is made possible by packaging up [OBS](https://obsproject.com/). We wouldn't stand a chance at providing something useful without it. Big thanks to the OBS developers.

This application is also heavily reliant on the [OBS Studio Node Packge](https://github.com/stream-labs/obs-studio-node) to provide bindings to libOBS. Special mention for the folks over at [Streamlabs](https://streamlabs.com/) for open-sourcing the project. 
