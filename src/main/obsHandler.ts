import * as osn from 'obs-studio-node';
import { EOBSOutputType, EOBSOutputSignal } from './obsEnums';

const WaitQueue = require('wait-queue');
const { v4: uuidfn } = require('uuid');
const path = require('path');

// Interfaces
export interface IPerformanceState {
  CPU: number;
  numberDroppedFrames: number;
  percentageDroppedFrames: number;
  streamingBandwidth: number;
  streamingDataOutput: number;
  recordingBandwidth: number;
  recordingDataOutput: number;
  frameRate: number;
  averageTimeToRenderFrame: number;
  memoryUsage: number;
  diskSpaceAvailable: string;
}

export interface IOBSOutputSignalInfo {
  type: EOBSOutputType;
  signal: EOBSOutputSignal;
  code: osn.EOutputCode;
  error: string;
}

export interface IConfigProgress {
  event: TConfigEvent;
  description: string;
  percentage?: number;
  continent?: string;
}

export interface IVec2 {
  x: number;
  y: number;
}

export interface ICrop {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Types
export type TOBSHotkey = {
  ObjectName: string;
  ObjectType: osn.EHotkeyObjectType;
  HotkeyName: string;
  HotkeyDesc: string;
  HotkeyId: number;
};

export type TConfigEvent =
  | 'starting_step'
  | 'progress'
  | 'stopping_step'
  | 'error'
  | 'done';

// OBSHandler class
export class OBSHandler {
  // Variables for obs initialization
  private workingDirectory: string = path.normalize(
    path.join(__dirname, '../../', 'node_modules', 'obs-studio-node')
  );

  private language: string = 'en-US';

  private obsPath: string = path.join(path.normalize(__dirname), 'osn-data');

  private pipeName: string = 'osn-tests-pipe-'.concat(uuidfn());

  private version: string = '0.00.00-preview.0';

  private crashServer: string = '';

  // Other variables/objects
  private osnTestName: string;

  signals = new WaitQueue();

  private progress = new WaitQueue();

  inputTypes: string[];

  filterTypes: string[];

  transitionTypes: string[];

  os: string;

  constructor(testName: string) {
    this.os = process.platform;
    this.osnTestName = testName;
    this.startup();
    this.inputTypes = osn.InputFactory.types();
    const index = this.inputTypes.indexOf('syphon-input', 0);
    if (index > -1) {
      this.inputTypes.splice(index, 1);
    }
    this.filterTypes = osn.FilterFactory.types();
    this.transitionTypes = osn.TransitionFactory.types();
  }

  startup() {
    let initResult: any;
    console.info(this.osnTestName, 'Initializing OBS');

    try {
      osn.NodeObs.IPC.host(this.pipeName);
      osn.NodeObs.SetWorkingDirectory(this.workingDirectory);
      initResult = osn.NodeObs.OBS_API_initAPI(
        this.language,
        this.obsPath,
        this.version,
        this.crashServer
      );
    } catch (e) {
      throw Error('Exception when initializing OBS process: ' + e);
    }

    if (initResult !== 0) { // @@@ ahk should be an enum that was missing
      throw Error('OBS process initialization failed with code ' + initResult);
    }

    console.info(this.osnTestName, 'OBS started successfully');
  }

  shutdown() {
    console.info(this.osnTestName, 'Shutting down OBS');

    try {
      osn.NodeObs.OBS_service_removeCallback();
      osn.NodeObs.IPC.disconnect();
    } catch (e) {
      throw Error('Exception when shutting down OBS process: ' + e);
    }

    console.info(this.osnTestName, 'OBS shutdown successfully');
  }

  setSetting(category: string, parameter: string, value: any) {
    let oldValue: any;

    // Getting settings container
    const settings = osn.NodeObs.OBS_settings_getSettings(category).data;

    settings.forEach((subCategory) => {
      subCategory.parameters.forEach((param) => {
        if (param.name === parameter) {
          oldValue = param.currentValue;
          param.currentValue = value;
        }
      });
    });

    // Saving updated settings container
    if (value !== oldValue) {
      osn.NodeObs.OBS_settings_saveSettings(category, settings);
    }
  }

  getSetting(category: string, parameter: string): any {
    let value: any;

    // Getting settings container
    const settings = osn.NodeObs.OBS_settings_getSettings(category).data;

    // Getting parameter value
    settings.forEach((subCategory) => {
      subCategory.parameters.forEach((param) => {
        if (param.name === parameter) {
          value = param.currentValue;
        }
      });
    });

    return value;
  }

  setSettingsContainer(category: string, settings: any) {
    osn.NodeObs.OBS_settings_saveSettings(category, settings);
  }

  getSettingsContainer(category: string): any {
    return osn.NodeObs.OBS_settings_getSettings(category).data;
  }

  connectOutputSignals() {
    osn.NodeObs.OBS_service_connectOutputSignals(
      (signalInfo: IOBSOutputSignalInfo) => {
        this.signals.push(signalInfo);
      }
    );
  }

  getNextSignalInfo(
    output: string,
    signal: string
  ): Promise<IOBSOutputSignalInfo> {
    return new Promise((resolve, reject) => {
      this.signals.shift().then(function (signalInfo) {
        resolve(signalInfo);
      });
      setTimeout(
        () => reject(new Error(`${output} ${signal} signal timeout`)),
        5000
      );
    });
  }

  getNextProgressInfo(autoconfigStep: string): Promise<IConfigProgress> {
    return new Promise((resolve, reject) => {
      this.progress.shift().then(function (progressInfo) {
        resolve(progressInfo);
      });
      setTimeout(
        () => reject(new Error(autoconfigStep + ' step timeout')),
        50000
      );
    });
  }
}
