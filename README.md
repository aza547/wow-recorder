# Warcraft Recorder

A desktop screen recorder application that records and saves videos of in-game events, and provides a graphical user interface to view the replays. 

Nothing magic happens here, the application watches the combat log file for events, records to disk and then plays back the recordings in the user interface.

![](https://i.imgur.com/PwuGFQ8.png)

#  How to Use
1. Download and run the most recent installer (e.g WarcraftRecorder.Setup.1.0.2.exe) from the [releases](https://github.com/aza547/wow-recorder/releases) section.
1. Launch the application and fill out the settings page. 
1. Enable combat logging in-game, I recommend the [SimpleCombatLogger](https://www.curseforge.com/wow/addons/simplecombatlogger) addon to automate this. 

# Bug Reports & Suggestions

Please create an issue, I will get to it eventually. Bear in mind maintaining this is a hobby for me, so it may take me some time to comment. If you think you can improve something, feel free to submit a PR.

#  Size Monitor

The configuration has a 'max storage' option. The app will never exceed this storage usage on disk. I suggest 100GB is a reasonable size for this setting. 

This feature is inspired by car dash cam behaviour: it deletes the oldest video when the size limit is hit. Be aware that if you want to keep a video long term you should copy it off to another location before it gets aged out. 

# Motivation

This project is free and open source software. It is built on the [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) repository. It is released in the hope that it will be useful to other players.

# License

Copyright (c) 2022 Alexander Kershaw

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: 

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.