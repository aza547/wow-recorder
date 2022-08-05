# Contributing

The below steps describe development on Windows. The app is currently not supported on other operating systems. 

## Start in Development Mode
Development mode benefits from the infrastructure offered by [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate). You can read more about it on their [docs](https://electron-react-boilerplate.js.org/). It allows for a very quick development cycle, access to chrome dev tools, and hot reloading of the app on saving new changes. 

1. Install Node.js from [here](https://nodejs.org/en/).
1. Clone a copy of the [wow-recorder](https://github.com/aza547/wow-recorder) codebase.
1. Change into the checkout directory. 
1. Run `npm install` on the command line to install required node packages.
1. Run `npm start` to launch the application.

## Building and Packaging
1. Build the electron application.
    1. Update the version number in `./release/app/package.json`. 
    1. Run `npm run package` to build the electron application. 
1. Share the application.
    1. Update the CHANGELOG.md with the new version number and change details. 
    1. Commit and push all changes.
	1. Tag a release on GitHub and attach the executable (e.g. `./release/build/WarcraftRecorder Setup 1.0.2.exe`).

## Microsoft Stamp of Approval
If we just build a .exe and release it Windows will warn it may be dangerous. Could resolve this buy purchasing a certificate from a CA, but it costs a fortune. Read more about it in this [issue](https://github.com/aza547/wow-recorder/issues/11).
1. Submit it for analysis [here](https://www.microsoft.com/en-us/wdsi/filesubmission) after releasing it to make that warning go away.
1. This isn't instant but seems to get resolved within 24 hours, that seems good enough. 
