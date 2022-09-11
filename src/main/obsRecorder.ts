import { fixPathWhenPackaged } from "./util";
import WaitQueue from 'wait-queue';
import { getAvailableAudioInputDevices, getAvailableAudioOutputDevices } from "./obsAudioDeviceUtils";
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
const reconfigure = (outputPath: string, monitorIndex: number, audioInputDeviceId: string, audioOutputDeviceId: string) => {
  configureOBS(outputPath);
  scene = setupScene(monitorIndex);
  setupSources(scene, audioInputDeviceId, audioOutputDeviceId);
}

/*
* Init the library, launch OBS Studio instance, configure it, set up sources and scene
*/
const initialize = (outputPath: string, monitorIndex: number, audioInputDeviceId: string, audioOutputDeviceId: string) => {
  if (obsInitialized) {
    console.warn("OBS is already initialized");
    return;
  }

  initOBS();
  configureOBS(outputPath);
  scene = setupScene(monitorIndex);
  setupSources(scene, audioInputDeviceId, audioOutputDeviceId);
  obsInitialized = true;
}

/*
* initOBS
*/
const initOBS = () => {
  console.debug('Initializing OBS...');
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

    const errorMessage = errorReasons[initResult.toString()] || `An unknown error #${initResult} was encountered while initializing OBS.`;

    console.error('OBS init failure', errorMessage);

    shutdown();

    throw Error(errorMessage);
  }

  osn.NodeObs.OBS_service_connectOutputSignals((signalInfo: any) => {
    waitQueue.push(signalInfo);
  });

  console.debug('OBS initialized');
}

/*
* configureOBS
*/
const configureOBS = (baseStoragePath: string) => {
  console.debug('Configuring OBS');
  setSetting('Output', 'Mode', 'Advanced');
  const availableEncoders = getAvailableValues('Output', 'Recording', 'RecEncoder');

  // Get a list of available encoders, select the last one.
  console.debug("Available encoder: " + JSON.stringify(availableEncoders));
  const selectedEncoder = availableEncoders.slice(-1)[0] || 'x264';
  console.debug("Selected encoder: " + selectedEncoder);
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

  console.debug('OBS Configured');
}

/*
* Get information about primary display
* @param zero starting monitor index
*/
const displayInfo = (displayIndex: number) => {
  const { screen } = require('electron');
  const displays = screen.getAllDisplays();
  console.info("Displays:", displays);
  const display = displays[displayIndex];
  const { width, height } = display.size;
  const { scaleFactor } = display;
  return {
    width,
    height,
    scaleFactor:    scaleFactor,
    aspectRatio:    width / height,
    physicalWidth:  width * scaleFactor,
    physicalHeight: height * scaleFactor,
  }
}

/*
* setupScene
*/
const setupScene = (monitorIndex: number) => {
  const videoSource = osn.InputFactory.create(byOS({ [OS.Windows]: 'monitor_capture', [OS.Mac]: 'display_capture' }), 'desktop-video');

  // Correct the monitorIndex. In config we start a 1 so it's easy for users. 
  const monitorIndexFromZero = monitorIndex - 1; 
  console.info("monitorIndexFromZero:", monitorIndexFromZero);
  const { physicalWidth, physicalHeight } = displayInfo(monitorIndexFromZero);

  // Update source settings:
  let settings = videoSource.settings;
  settings['monitor'] = monitorIndexFromZero;
  settings['width'] = physicalWidth;
  settings['height'] = physicalHeight;
  videoSource.update(settings);
  videoSource.save();

  const outputWidth = physicalWidth;
  const outputHeight = physicalHeight;
  
  setSetting('Video', 'Base', `${outputWidth}x${outputHeight}`);
  setSetting('Video', 'Output', `${outputWidth}x${outputHeight}`);
  const videoScaleFactor = physicalWidth / outputWidth;

  // A scene is necessary here to properly scale captured screen size to output video size
  const scene = osn.SceneFactory.create('test-scene');
  const sceneItem = scene.add(videoSource);
  sceneItem.scale = { x: 1.0/ videoScaleFactor, y: 1.0 / videoScaleFactor };

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
      console.log(`[ObsConfig] Selecting audio input device: ${device.name} ${source.muted ? ' [MUTED]' : ''}`)
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
      console.log(`[ObsConfig] Selecting audio output device: ${device.name} ${source.muted ? ' [MUTED]' : ''}`)
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

  console.log("obsRecorder: start");
  osn.NodeObs.OBS_service_startRecording();

  let signalInfo = await waitQueue.shift();
  assertSignal(signalInfo, "recording", "start");
}

/*
* stop
*/
const stop = async () => {
  console.log("obsRecorder: stop");
  osn.NodeObs.OBS_service_stopRecording();

  let signalInfo = await waitQueue.shift();
  assertSignal(signalInfo, "recording", "stopping");
  
  signalInfo = await waitQueue.shift();
  assertSignal(signalInfo, "recording", "stop");

  signalInfo = await waitQueue.shift();
  assertSignal(signalInfo, "recording", "wrote");
}

/*
* shutdown
*/
const shutdown = () => {
  if (!obsInitialized) {
    console.debug('OBS is already shut down!');
    return false;
  }

  console.debug('Shutting down OBS...');

  try {
    osn.NodeObs.OBS_service_removeCallback();
    osn.NodeObs.IPC.disconnect();
    obsInitialized = false;
  } catch(e) {
    throw Error('Exception when shutting down OBS process' + e);
  }

  console.debug('OBS shutdown successfully');

  return true;
}

/*
* setSetting
*/
const setSetting = (category: any, parameter: any, value: any) => {
  let oldValue;

  console.debug('OBS: setSetting', category, parameter, value);

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
    console.warn(`There is no category ${category} in OBS settings`);
    return;
  }

  const subcategorySettings = categorySettings.find((sub: any) => sub.nameSubCategory === subcategory);

  if (!subcategorySettings) {
    console.warn(`There is no subcategory ${subcategory} for OBS settings category ${category}`);
    return;
  }

  const parameterSettings = subcategorySettings.parameters.find((param: any) => param.name === parameter);
  
  if (!parameterSettings) {
    console.warn(`There is no parameter ${parameter} for OBS settings category ${category}.${subcategory}`);
    return;
  }

  return parameterSettings.values.map( (value: any) => Object.values(value)[0]);
}


/*
* Assert a signal from OBS is as expected, otherwise throw an error. 
*/
const assertSignal = (signalInfo: any, type: string, value: string) => {

  if (signalInfo === undefined) {
    throw Error("OBS behaved unexpectedly (1)");
  }

  // Assert the type is as expected.
  if (signalInfo.type !== type) {
    console.error(signalInfo);
    console.error("OBS signal type unexpected", signalInfo.signal, value);
    throw Error("OBS behaved unexpectedly (2)");
  }

  // Assert the signal value is as expected.
  if (signalInfo.signal !== value) {
    console.error(signalInfo);
    console.error("OBS signal value unexpected", signalInfo.signal, value);
    throw Error("OBS behaved unexpectedly (3)");
  }

  console.debug("Asserted OBS signal:", type, value);
}

export {
  initialize,
  start,
  stop,
  shutdown,
  reconfigure
}
