# Contributing

The below steps describe development on Windows. The app is currently not supported on other operating systems. 

## Start in Development Mode
Development mode benefits from the infrastructure offered by [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate). You can read more about it on their [docs](https://electron-react-boilerplate.js.org/). It allows for a very quick development cycle, access to chrome dev tools, and hot reloading of the app on saving new changes. 

1. Install Node.js version 16 (latest at time of writing is 16.17.0) from [here](https://nodejs.org/en/).
1. Clone a copy of the [wow-recorder](https://github.com/aza547/wow-recorder) codebase.
1. Change into the checkout directory. 
1. Run `npm install` on the command line to install required node packages.
1. Run `npm start` to launch the application.

## Building, Packaging and Releasing
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
	1. Tag a release on GitHub and attach the executable (e.g. `./release/build/WarcraftRecorder Setup 1.0.2.exe`).

## Tests

1. Run `npm test` to run the UTs. 
    1. These are `jest` based unit tests. 
    2. Note: This is a WIP - the UTs currently are not useful.
2. To run end-to-end tests (requires some hardcoded path updates):
    * All tests: `python .\resources\test-scripts\all_tests.py`.
    * Individual test: `python .\resources\test-scripts\2v2.py`.

## Debugging Mode
You can use VSCode's JavaScript Debug terminal to step through the code, add breakpoints, view variables and the other IDE features.  

1. Go to file, new terminal. 
1. Click the arrow next to the "+" icon. 
1. Select "JavaScrtip Debug Terminal". See below image.
1. Run the application in development mode as per above instructions (i.e. `npm start`).
1. Enjoy the ability to use the IDE features.

<img src="https://i.imgur.com/zFIaGHa.png" width="200">

## Building OSN
The [obs-studio-node](https://github.com/stream-labs/obs-studio-node) package we heavily rely on is not build by the developers, or uploaded to NPM. We have to build it and host the tarball ourselves if we want to have repeatable builds.

The build instructions on obs-studio-node's GitHub page are not perfect, there is a better set [here](https://github.com/Envek/obs-studio-node-example). I've pasted below and adapted for our use so we aren't relying on external links for our build process. 

 1. Build it somewhere ([look at the docs first](https://github.com/stream-labs/obs-studio-node#building))

    ```sh
    git clone https://github.com/stream-labs/obs-studio-node.git
    cd obs-studio-node
    yarn install
    git submodule update --init --recursive
    mkdir build
    cd build
    cmake .. -G"Visual Studio 15 2017" -A x64 -DCMAKE_INSTALL_PREFIX="SOME_WRITABLE_PATH"
    cmake --build . --config Release
    cpack -G TGZ
    ```
 2. Host it on a file sharing platform of your choice so that it's downloadable via a URL. I've used Azure for this, for example I build 0.22.10 and hosted it [here](https://wowrecorder.blob.core.windows.net/wowrecorder/obs-studio-node-0.22.10-win64.tar.gz). 
 
 3. Place the URL to it to `package.json`. You should do this in both package.json files in the project, this is important for distributing. 

    ```json
    {
        "devDependencies": {
            "obs-studio-node": "https://wowrecorder.blob.core.windows.net/wowrecorder/obs-studio-node-0.22.10-win64.tar.gz"
        }
    }

 4. If desperate to include it as a file without hosting on the web you can:

    ```json
    {
        "devDependencies": {
            "obs-studio-node": "file://C:/where/you/cloned/obs-studio-node/build/obs-studio-node-1.2.3-win64.tar.gz"
        }
    }

 5. Build the application with `npm run package`. 

Below are various additional OSN resources:
- [Example](https://github.com/Envek/obs-studio-node-example)
- [Community Docs](https://github.com/hrueger/obs-studio-node-docs)
- [Streamlabs Desktop](https://github.com/stream-labs/desktop)
- [Enlyo Recorder](https://github.com/Enlyo/enlyo-recorder)

## Microsoft Stamp of Approval
If we just build a .exe and release it Windows will warn it may be dangerous. Could resolve this buy purchasing a certificate from a CA, but it costs a fortune. Read more about it in this [issue](https://github.com/aza547/wow-recorder/issues/11).
1. Submit it for analysis [here](https://www.microsoft.com/en-us/wdsi/filesubmission) after releasing it to make that warning go away.
    1. Select "Microsoft Defender Smartscreen" as the security product. 
    1. "Company name" - just put your own name. 
    1. "Do you have a Microsoft support case number?" - No.
    1. Leave next few fields blank/unchanged. 
    1. Select & upload the .exe. 
    1. "What do you believe this file is?" - Incorrectly detected as malware/malicious
    1. Detection name - "WarcraftRecorder.Setup.2.0.1.exe"
    1. "Additional information" - whatever, I'm sure no one will read it. 
1. This isn't instant but seems to get resolved within 24 hours, that seems good enough. 
