import { EVideoFormat } from 'obs-studio-node';
import * as osn from 'obs-studio-node';

console.log('ahk1');

osn.VideoFactory.videoContext = {
  fpsNum: 60,
  fpsDen: 1,
  baseWidth: 1920,
  baseHeight: 1080,
  outputWidth: 1280,
  outputHeight: 720,
  outputFormat: 2,
  colorspace: 2,
  range: 2,
  scaleType: 3,
  fpsType: 2,
};

console.log('ahk2');
const recording = osn.AdvancedRecordingFactory.create();
