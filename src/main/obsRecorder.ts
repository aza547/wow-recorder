const path = require('path');
const { Subject } = require('rxjs');
const { first } = require('rxjs/operators');
const { byOS, OS } = require('./operatingSystems');

const osn = require("obs-studio-node");
const { v4: uuid } = require('uuid');

let obsInitialized = false;
let scene = null;

// When packaged, we need to fix some paths
function fixPathWhenPackaged(p) {
  return p.replace("app.asar", "app.asar.unpacked");
}

// Init the library, launch OBS Studio instance, configure it, set up sources and scene
function initialize(baseStoragePath: string) {
  if (obsInitialized) {
    console.warn("OBS is already initialized, skipping initialization.");
    return;
  }

  initOBS();
  configureOBS(baseStoragePath);
  scene = setupScene();
  setupSources(scene);
  obsInitialized = true;
}

function initOBS() {
  console.debug('Initializing OBS...');
  osn.NodeObs.IPC.host(`obs-studio-node-example-${uuid()}`);
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

  osn.NodeObs.OBS_service_connectOutputSignals((signalInfo) => {
    signals.next(signalInfo);
  });

  console.debug('OBS initialized');
}

function configureOBS(baseStoragePath: string) {
  console.debug('Configuring OBS');
  setSetting('Output', 'Mode', 'Advanced');
  const availableEncoders = getAvailableValues('Output', 'Recording', 'RecEncoder');
  setSetting('Output', 'RecEncoder', availableEncoders.slice(-1)[0] || 'x264');
  setSetting('Output', 'RecFilePath', baseStoragePath);
  setSetting('Output', 'RecFormat', 'mp4');

  // No idea how this works, but it does. 
  setSetting('Output', 'Recbitrate', 'lossless'); 
  setSetting('Output', 'Recmax_bitrate', 300000); 

  setSetting('Video', 'FPSCommon', 60);

  console.debug('OBS Configured');
}

// Get information about primary display
function displayInfo() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const { scaleFactor } = primaryDisplay;
  return {
    width,
    height,
    scaleFactor:    scaleFactor,
    aspectRatio:    width / height,
    physicalWidth:  width * scaleFactor,
    physicalHeight: height * scaleFactor,
  }
}

function setupScene() {
  const videoSource = osn.InputFactory.create(byOS({ [OS.Windows]: 'monitor_capture', [OS.Mac]: 'display_capture' }), 'desktop-video');
  
  const { physicalWidth, physicalHeight } = displayInfo();

  // Update source settings:
  let settings = videoSource.settings;
  settings['width'] = physicalWidth;
  settings['height'] = physicalHeight;
  videoSource.update(settings);
  videoSource.save();

  // Set output video size to 1920x1080
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

function getAudioDevices(type, subtype) {
  const dummyDevice = osn.InputFactory.create(type, subtype, { device_id: 'does_not_exist' });
  const devices = dummyDevice.properties.get('device_id').details.items.map(({ name, value }) => {
    return { device_id: value, name,};
  });
  dummyDevice.release();
  return devices;
};

function setupSources(scene) {
  osn.Global.setOutputSource(1, scene);

  setSetting('Output', 'Track1Name', 'Mixed: all sources');
  let currentTrack = 2;

  getAudioDevices(byOS({ [OS.Windows]: 'wasapi_output_capture', [OS.Mac]: 'coreaudio_output_capture' }), 'desktop-audio').forEach(metadata => {
    if (metadata.device_id === 'default') return;
    const source = osn.InputFactory.create(byOS({ [OS.Windows]: 'wasapi_output_capture', [OS.Mac]: 'coreaudio_output_capture' }), 'desktop-audio', { device_id: metadata.device_id });
    setSetting('Output', `Track${currentTrack}Name`, metadata.name);
    source.audioMixers = 1 | (1 << currentTrack-1); // Bit mask to output to only tracks 1 and current track
    osn.Global.setOutputSource(currentTrack, source);
    currentTrack++;
  });

  getAudioDevices(byOS({ [OS.Windows]: 'wasapi_input_capture', [OS.Mac]: 'coreaudio_input_capture' }), 'mic-audio').forEach(metadata => {
    if (metadata.device_id === 'default') return;
    const source = osn.InputFactory.create(byOS({ [OS.Windows]: 'wasapi_input_capture', [OS.Mac]: 'coreaudio_input_capture' }), 'mic-audio', { device_id: metadata.device_id });
    setSetting('Output', `Track${currentTrack}Name`, metadata.name);
    source.audioMixers = 1 | (1 << currentTrack-1); // Bit mask to output to only tracks 1 and current track
    osn.Global.setOutputSource(currentTrack, source);
    currentTrack++;
  });

  setSetting('Output', 'RecTracks', parseInt('1'.repeat(currentTrack-1), 2)); // Bit mask of used tracks: 1111 to use first four (from available six)
}

async function start() {
  if (!obsInitialized) initialize();

  let signalInfo;

  console.debug('Starting recording...');
  osn.NodeObs.OBS_service_startRecording();

  console.debug('Started?');
  signalInfo = await getNextSignalInfo();

  if (signalInfo.signal === 'Stop') {
    throw Error(signalInfo.error);
  }

  console.debug('Started signalInfo.type:', signalInfo.type, '(expected: "recording")');
  console.debug('Started signalInfo.signal:', signalInfo.signal, '(expected: "start")');
  console.debug('Started!');
}

async function stop() {
  let signalInfo;

  console.debug('Stopping recording...');
  osn.NodeObs.OBS_service_stopRecording();
  console.debug('Stopped?');

  signalInfo = await getNextSignalInfo();

  console.debug('On stop signalInfo.type:', signalInfo.type, '(expected: "recording")');
  console.debug('On stop signalInfo.signal:', signalInfo.signal, '(expected: "stopping")');

  signalInfo = await getNextSignalInfo();

  console.debug('After stop signalInfo.type:', signalInfo.type, '(expected: "recording")');
  console.debug('After stop signalInfo.signal:', signalInfo.signal, '(expected: "stop")');

  console.debug('Stopped!');
}

function shutdown() {
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

function setSetting(category, parameter, value) {
  let oldValue;

  // Getting settings container
  const settings = osn.NodeObs.OBS_settings_getSettings(category).data;

  settings.forEach(subCategory => {
    subCategory.parameters.forEach(param => {
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

function getAvailableValues(category, subcategory, parameter) {
  const categorySettings = osn.NodeObs.OBS_settings_getSettings(category).data;
  if (!categorySettings) {
    console.warn(`There is no category ${category} in OBS settings`);
    return [];
  }

  const subcategorySettings = categorySettings.find(sub => sub.nameSubCategory === subcategory);
  if (!subcategorySettings) {
    console.warn(`There is no subcategory ${subcategory} for OBS settings category ${category}`);
    return [];
  }

  const parameterSettings = subcategorySettings.parameters.find(param => param.name === parameter);
  if (!parameterSettings) {
    console.warn(`There is no parameter ${parameter} for OBS settings category ${category}.${subcategory}`);
    return [];
  }

  return parameterSettings.values.map( value => Object.values(value)[0]);
}

const signals = new Subject();

function getNextSignalInfo() {
  return new Promise((resolve, reject) => {
    signals.pipe(first()).subscribe(signalInfo => resolve(signalInfo));
    setTimeout(() => reject('Output signal timeout'), 30000);
  });
}

export {
  initialize,
  start,
  stop,
  shutdown
}
