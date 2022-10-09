
import WaitQueue from 'wait-queue';

import { RecorderOptionsType } from "./recorder";

const waitQueue = new WaitQueue<any>();

const osn = require("obs-studio-node");


let obsInitialized = false;
let scene = null;

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

/**
 * Simply return a list of available resolutions from OBS for 'Base' and 'Output
 */
const getObsResolutions = (): any => {
  return {
    'Base':   getAvailableValues('Video', 'Untitled', 'Base'),
    'Output': getAvailableValues('Video', 'Untitled', 'Output')
  };
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
  getObsResolutions,
}
