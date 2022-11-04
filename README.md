# Warcraft Recorder

A desktop screen recorder application that records and saves videos of in-game events, and provides a graphical user interface to view the replays. 

Nothing magic happens here, the application watches the combat log file for events, records to disk and then plays back the recordings in the user interface.

Windows is currently the only supported operating system. 

![](https://i.imgur.com/6GaC0bE.png)

#  How to Use
1. Download and run the most recent installer (e.g WarcraftRecorder.Setup.2.9.0.exe) from the [releases](https://github.com/aza547/wow-recorder/releases) section.
1. Launch the application and fill out the settings page.
1. Enable combatlogging.
    - Retail: Install and configure the SimpleCombatLogger ([CurseForge](https://www.curseforge.com/wow/addons/simplecombatlogger),[Wago](https://addons.wago.io/addons/simplecombatlogger),[Github](https://github.com/csutcliff/SimpleCombatLogger)) addon.
    - Classic: Install and configure the AutoCombatLogger ([CurseForge](https://www.curseforge.com/wow/addons/autocombatlogger),[Wago](https://addons.wago.io/addons/autocombatlogger),[Github](https://github.com/Talryn/AutoCombatLogger)) addon. 

An example of valid config can be found below.

<img src="https://i.imgur.com/MTiLlOh.png" width="300">

If you are an arena player, I also strongly recommend the [jaxSurrender](https://www.curseforge.com/wow/addons/jaxsurrender) addon.

# Testing It Works

You can test that Warcraft Recorder works by clicking the test icon with World of Warcraft running after you have completed the above setup steps. 

This runs a 10 second test of the recording functionality by mimicing a 2v2 game.

<img src="https://i.imgur.com/bwChWgI.png">

# Bug Reports & Suggestions

Please create an issue, I will get to it eventually. Bear in mind maintaining this is a hobby for me, so it may take me some time to comment. If you think you can improve something, feel free to submit a PR.

I've created a dedicated discord for this project, feel free to join [here](https://discord.gg/NPha7KdjVk).

# Motivation

This project is free and open source. It is built on the [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) repository. It is released in the hope that it will be useful to other players.

# Contributing

If you're interested in getting involved please drop me a message on discord and I can give you access to our development channel. Also see [contributing](https://github.com/aza547/wow-recorder/blob/main/CONTRIBUTING.md) docs.
