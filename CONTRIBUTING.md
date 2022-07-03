# Contributing

The below steps are how to launch the app in development mode on Windows. 

1. Install Node.js from [here](https://nodejs.org/en/).
1. Clone a copy of the [wow-recorder](https://github.com/aza547/wow-recorder) codebase.
1. Change into the checkout directory. 
1. Run `npm install` on the command line to install required node packages.
1. Run `npm start` to launch the application.

To package and distritubte the application on Windows, 3 steps are currently required. 

1. Rebuild the python screen recorder executable. Not required if you have not made python code changes.
	1. `pyinstaller ./python/main.py -n "recorder"`
	2. Copy the contents of the built `./python/dist/recorder` folder over the contents of `./win64recorder`. 
1. Build the electron application.
    1. Update the version number in `./release/app/package.json`. 
    1. Run `npm run package` to build the electron application. 
1. Share the application.
    1. Update the CHANGELOG.md with the new version number and change details. 
    1. Commit and push all changes.
	1. Tag a release on GitHub and attach the executable (e.g. `./release/build/WarcraftRecorder Setup 1.0.2.exe`).

This relies on the awesome infrascturcture offered by electron-react-boilerplate. You can read more about it on their [docs](https://electron-react-boilerplate.js.org/).  