# Contributing

The below steps describe development on Windows. The app is currently not supported on other operating systems. 

## Architecture
Once I drew the structure of the application in Excalidraw. You can see that below. It's a rough overview of the key parts and may be a useful overview for any interested developers.
![](https://i.imgur.com/UbZ0aWY.png)
You can find the source in the `design.excalidraw` file in this directory.

## Start in Development Mode
Development mode benefits from the infrastructure offered by [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate). You can read more about it on their [docs](https://electron-react-boilerplate.js.org/). It allows for a very quick development cycle, access to chrome dev tools, and hot reloading of the app on saving new changes. 

1. Install the latest version of Node.js version (latest at time of writing is 20.4.0) from [here](https://nodejs.org/en/).
1. Install [VS Studio and the C++ SDK](https://learn.microsoft.com/en-us/cpp/build/vscpp-step-0-installation?view=msvc-170), required as installing dependencies recompiles [noobs](https://github.com/aza547/noobs).
1. Clone a copy of the [wow-recorder](https://github.com/aza547/wow-recorder) codebase.
1. Change into the checkout directory. 
1. Run `npm install` on the command line to install required node packages.
1. (Windows Only) Run `npm start` to launch the application in development mode.
1. (Linux Only) Run the `./run-dev-linux.sh` script to launch the application in development mode.

## Building, Packaging and Releasing
> As of 3.3.1, we have CI builds for all commits to main.
> As of 6.8.2, only the tests run in the CI. Can't build in the CI now that we're signing the exe.
1. Build the electron application.
    1. Update the version number in `./release/app/package.json` if appropriate.  
    1. Run `npm run package` to build the electron application. 
1. Install the .exe and run the tests to make sure you've not broken something crass.
    1. With WarcraftRecorder open, run: `python .\resources\test-scripts\all_tests.py`.
    1. Manually check the app behaves as expected while this runs.
        1. Recordings are created.
        1. Appropriate metadata is created.
        1. User experience has not degraded.
1. Share the application.
    1. Update the CHANGELOG.md with the new version number and change details. 
    1. Commit and push all changes.
    1. Tag a release on GitHub and attach the built files:
      - `./release/build/WarcraftRecorder-Setup-X.Y.Z.exe` to enable installation.
      - `./release/build/latest.yml` to allow the auto updater to function. 
      - `./release/build/WarcraftRecorder-Setup-6.8.0.exe.blockmap` to allow the auto updater to function. 

## Tests
1. Run `npm test` to run the UTs. 
    1. These are `jest` based unit tests. 
    2. Note: This is a WIP - the UTs currently are not useful.
2. To run end-to-end tests (requires some hardcoded path updates):
    * All tests: `python .\resources\test-scripts\all_tests.py`.
    * Individual test: `python  .\resources\test-scripts\retail_mythic_plus.py`.

## Debugging Mode
You can use VSCode's JavaScript Debug terminal to step through the code, add breakpoints, view variables and the other IDE features.  

1. Go to file, new terminal. 
1. Click the arrow next to the "+" icon. 
1. Select "JavaScrtip Debug Terminal". See below image.
1. Run the application in development mode as per above instructions (i.e. `npm start`).
1. Enjoy the ability to use the IDE features.

<img src="https://i.imgur.com/zFIaGHa.png" width="200">

## Debugging in Production with Dev Tools
From [here](https://electron-react-boilerplate.js.org/docs/packaging).

`npx cross-env DEBUG_PROD=true npm run package`

