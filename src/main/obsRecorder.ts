import { fixPathWhenPackaged, getAvailableDisplays, isNumberClose } from "./util";
import WaitQueue from 'wait-queue';
import { getAvailableAudioInputDevices, getAvailableAudioOutputDevices } from "./obsAudioDeviceUtils";
import { RecorderOptionsType } from "./recorder";
import { OurDisplayType } from "./types";
const waitQueue = new WaitQueue<any>();
const path = require('path');
const { byOS, OS } = require('./operatingSystems');
const osn = require("obs-studio-node");
const { v4: uuid } = require('uuid');

let obsInitialized = false;
let scene = null;

/*
* Reconfigure the recorder without destroying it.
*/
const reconfigure = (options: RecorderOptionsType) => {
  configureOBS(options.bufferStorageDir);
  scene = setupScene(options.monitorIndex);
  setupSources(scene, options.audioInputDeviceId, options.audioOutputDeviceId);
}

/*
* Init the library, launch OBS Studio instance, configure it, set up sources and scene
*/
const initialize = (options: RecorderOptionsType) => {
  if (obsInitialized) {
    console.warn("[OBS] OBS is already initialized");
    return;
  }

  initOBS();
  reconfigure(options);
  obsInitialized = true;
}

/*
* initOBS
*/
const initOBS = () => {
  console.debug('[OBS] Initializing OBS...');
  osn.NodeObs.IPC.host(`warcraft-recorder-${uuid()}`);
  osn.NodeObs.SetWorkingDirectory(fixPathWhenPackaged(path.join(__dirname,'../../', 'node_modules', 'obs-studio-node')));

  const obsDataPath = fixPathWhenPackaged(path.join(__dirname, 'osn-data')); // OBS Studio configs and logs
  // Arguments: locale, path to directory where configuration and logs will be stored, your application version
  const initResult = osn.NodeObs.OBS_API_initAPI('en-US', obsDataPath, '1.0.0');

  if (initResult !== 0) {
    const errorReasons = {
      '-2': 'DirectX could not be found on your system. Please install the latest version of DirectX for your machine here <https://www.microsoft.com/en-us/download/details.aspx?id=35?> and try again.',
      '-5': 'Failed to initialize OBS. Your video drivers may be out of date, or Streamlabs OBS may not be supported on your system.',
    }

    // @ts-ignore
    const errorMessage = errorReasons[initResult.toString()] || `An unknown error #${initResult} was encountered while initializing OBS.`;

    console.error('[OBS] OBS init failure', errorMessage);

    shutdown();

    throw Error(errorMessage);
  }

  osn.NodeObs.OBS_service_connectOutputSignals((signalInfo: any) => {
    waitQueue.push(signalInfo);
  });

  console.debug('[OBS] OBS initialized');
}

/*
* configureOBS
*/
const configureOBS = (baseStoragePath: string) => {
  console.debug('[OBS] Configuring OBS');
  setSetting('Output', 'Mode', 'Advanced');
  const availableEncoders = getAvailableValues('Output', 'Recording', 'RecEncoder');

  // Get a list of available encoders, select the last one.
  console.debug("[OBS] Available encoder: " + JSON.stringify(availableEncoders));
  const selectedEncoder = availableEncoders.slice(-1)[0] || 'x264';
  console.debug("[OBS] Selected encoder: " + selectedEncoder);
  setSetting('Output', 'RecEncoder', selectedEncoder);

  // Set output path and video format.
  setSetting('Output', 'RecFilePath', baseStoragePath);
  setSetting('Output', 'RecFormat', 'mp4');
  
  if (selectedEncoder.toLowerCase().includes("amf")) {
    // For AMF encoders, can't set 'lossless' bitrate.
    // It interprets it as zero and fails to start.
    // See https://github.com/aza547/wow-recorder/issues/40.
    setSetting('Output', 'Recbitrate', 50000);
  }
  else {
    // No idea how this works, but it does. 
    setSetting('Output', 'Recbitrate', 'Lossless');
  }
   
  setSetting('Output', 'Recmax_bitrate', 300000); 
  setSetting('Video', 'FPSCommon', 60);

  console.debug('[OBS] OBS Configured');
}

/*
* Get information about primary display
* @param zero starting monitor index
*/
const displayInfo = (displayIndex: number): OurDisplayType | undefined => {
  const displays = getAvailableDisplays();
  console.info("[OBS] Displays:", displays);

  return displays.find(d => d.index === displayIndex);
}

/*
* Checks if string {W}x{H} resolution is close enough to monitor resolution
* @param resolution - Resolution string of OBS in format {W}x{H}
*/
const checkRes = (monitorWidth: number, monitorHeight: number, resolution: string) => {
  const [resWidth, resHeight] = resolution.split('x');
  const isWidthClose = isNumberClose(parseInt(resWidth, 10), monitorWidth);
  const isHeightClose = isNumberClose(parseInt(resHeight, 10), monitorHeight);
  return isWidthClose && isHeightClose;
};

/*
* Given a none-whole monitor resolution, find the closest one that 
* OBS supports and set the corospoding setting in Video.Untitled.{paramString}
* 
* @remarks
* Useful when windows scaling is not set to 100% (125%, 150%, etc) on higher resolution monitors, 
* meaning electron screen.getAllDisplays() will return a none integer scaleFactor, causing 
* the calucated monitor resolution to be none-whole.
*
* @throws
* Throws an error if no matching resolution is found.
*/
const setOBSVideoResolution = (monitorWidth: number, monitorHeight: number, paramString: string) => {
  const availableResolutions = getAvailableValues('Video', 'Untitled', paramString);

  for(let i = 0; i < availableResolutions.length; i++) {
    const resolution: string = availableResolutions[i];

    if (checkRes(monitorWidth, monitorHeight, resolution)) {
      setSetting('Video', paramString, resolution);
      return;
    }
  }
  
  console.error('[OBS] ERROR! Matching resolution not found for Video Output');
  console.error(`Error attempting to match ${monitorWidth}x${monitorHeight} with ${availableResolutions} for ${paramString}`);
  
  throw Error('Matching resolution not found for Video Output');
}

/*
* setupScene
*/
const setupScene = (monitorIndex: number) => {
  // Correct the monitorIndex. In config we start a 1 so it's easy for users. 
  const monitorIndexFromZero = monitorIndex - 1;
  console.info("[OBS] monitorIndexFromZero:", monitorIndexFromZero);
  const selectedDisplay = displayInfo(monitorIndexFromZero);
  if (!selectedDisplay) {
    throw Error(`[OBS] No such display with index: ${monitorIndexFromZero}.`)
  }

  const { width: physicalWidth, height: physicalHeight } = selectedDisplay.physicalSize;

  setOBSVideoResolution(physicalWidth, physicalHeight, 'Base');

  // TODO: Output should eventually be moved into a setting field to be scaled down. For now it matches the monitor resolution.
  setOBSVideoResolution(physicalWidth, physicalHeight, 'Output');

  const videoSource = osn.InputFactory.create(byOS({ [OS.Windows]: 'monitor_capture', [OS.Mac]: 'display_capture' }), 'desktop-video');

  // Update source settings:
  let settings = videoSource.settings;
  settings['monitor'] = monitorIndexFromZero;
  videoSource.update(settings);
  videoSource.save();

  // A scene is necessary here to properly scale captured screen size to output video size
  const scene = osn.SceneFactory.create('test-scene');
  const sceneItem = scene.add(videoSource);
  sceneItem.scale = { x: 1.0, y: 1.0 };

  return scene;
}

/*
* setupSources
*/
const setupSources = (scene: any, audioInputDeviceId: string, audioOutputDeviceId: string ) => {
  osn.Global.setOutputSource(1, scene);

  setSetting('Output', 'Track1Name', 'Mixed: all sources');
  let currentTrack = 2;

  getAvailableAudioInputDevices()
    .forEach(device => {
      const source = osn.InputFactory.create(byOS({ [OS.Windows]: 'wasapi_input_capture', [OS.Mac]: 'coreaudio_input_capture' }), 'mic-audio', { device_id: device.id });
      setSetting('Output', `Track${currentTrack}Name`, device.name);
      source.audioMixers = 1 | (1 << currentTrack-1); // Bit mask to output to only tracks 1 and current track
      source.muted = audioInputDeviceId === 'none' || (audioInputDeviceId !== 'all' && device.id !== audioInputDeviceId);
      console.log(`[OBS] Selecting audio input device: ${device.name} ${source.muted ? ' [MUTED]' : ''}`)
      osn.Global.setOutputSource(currentTrack, source);
      source.release()
      currentTrack++;
    });

  getAvailableAudioOutputDevices()
    .forEach(device => {
      const source = osn.InputFactory.create(byOS({ [OS.Windows]: 'wasapi_output_capture', [OS.Mac]: 'coreaudio_output_capture' }), 'desktop-audio', { device_id: device.id });
      setSetting('Output', `Track${currentTrack}Name`, device.name);
      source.audioMixers = 1 | (1 << currentTrack-1); // Bit mask to output to only tracks 1 and current track
      source.muted = audioOutputDeviceId === 'none' || (audioOutputDeviceId !== 'all' && device.id !== audioOutputDeviceId);
      console.log(`[OBS] Selecting audio output device: ${device.name} ${source.muted ? ' [MUTED]' : ''}`)
      osn.Global.setOutputSource(currentTrack, source);
      source.release()
      currentTrack++;
    });

  setSetting('Output', 'RecTracks', parseInt('1'.repeat(currentTrack-1), 2)); // Bit mask of used tracks: 1111 to use first four (from available six)
}

/*
* start
*/
const start = async () => {
  if (!obsInitialized) {
    throw Error("OBS not initialised")
  }

  console.log("[OBS] obsRecorder: start");
  osn.NodeObs.OBS_service_startRecording();
  assertNextSignal("start");
}

/*
* stop
*/
const stop = async () => {
  console.log("[OBS] obsRecorder: stop");
  osn.NodeObs.OBS_service_stopRecording();
  assertNextSignal("stopping");
  assertNextSignal("stop");
  assertNextSignal("wrote");
}

/*
* shutdown
*/
const shutdown = () => {
  if (!obsInitialized) {
    console.debug('[OBS]  OBS is already shut down!');
    return false;
  }

  console.debug('[OBS]  Shutting down OBS...');

  try {
    osn.NodeObs.OBS_service_removeCallback();
    osn.NodeObs.IPC.disconnect();
    obsInitialized = false;
  } catch(e) {
    throw Error('Exception when shutting down OBS process' + e);
  }

  console.debug('[OBS]  OBS shutdown successfully');

  return true;
}

/*
* setSetting
*/
const setSetting = (category: any, parameter: any, value: any) => {
  let oldValue;

  console.debug('[OBS] OBS: setSetting', category, parameter, value);

  // Getting settings container
  const settings = osn.NodeObs.OBS_settings_getSettings(category).data;

  settings.forEach((subCategory: any) => {
    subCategory.parameters.forEach((param: any) => {
      if (param.name === parameter) {        
        oldValue = param.currentValue;
        param.currentValue = value;
      }
    });
  });

  // Saving updated settings container
  if (value != oldValue) {
    osn.NodeObs.OBS_settings_saveSettings(category, settings);
  }
}

/*
* getAvailableValues
*/
const getAvailableValues = (category: any, subcategory: any, parameter: any) => {
  const categorySettings = osn.NodeObs.OBS_settings_getSettings(category).data;

  if (!categorySettings) {
    console.warn(`[OBS] There is no category ${category} in OBS settings`);
    return;
  }

  const subcategorySettings = categorySettings.find((sub: any) => sub.nameSubCategory === subcategory);

  if (!subcategorySettings) {
    console.warn(`[OBS] There is no subcategory ${subcategory} for OBS settings category ${category}`);
    return;
  }

  const parameterSettings = subcategorySettings.parameters.find((param: any) => param.name === parameter);
  
  if (!parameterSettings) {
    console.warn(`[OBS] There is no parameter ${parameter} for OBS settings category ${category}.${subcategory}`);
    return;
  }

  return parameterSettings.values.map( (value: any) => Object.values(value)[0]);
}


/*
* Assert a signal from OBS is as expected, if it is not received
* within 5 seconds or is not as expected then throw an error. 
*/
const assertNextSignal = async (value: string) => {

  // Don't wait more than 5 seconds for the signal.
  let signalInfo = await Promise.race([
    waitQueue.shift(), 
    new Promise((_, reject) => {
      setTimeout(reject, 5000, "OBS didn't signal " + value + " in time")}
    )
  ]);

  // Assert the type is as expected.
  if (signalInfo.type !== "recording") {
    console.error("[OBS] " + signalInfo);
    console.error("[OBS] OBS signal type unexpected", signalInfo.signal, value);
    throw Error("OBS behaved unexpectedly (2)");
  }

  // Assert the signal value is as expected.
  if (signalInfo.signal !== value) {
    console.error("[OBS] " + signalInfo);
    console.error("[OBS] OBS signal value unexpected", signalInfo.signal, value);
    throw Error("OBS behaved unexpectedly (3)");
  }

  console.debug("[OBS] Asserted OBS signal:", value);
}

export {
  initialize,
  start,
  stop,
  shutdown,
  reconfigure,
}
