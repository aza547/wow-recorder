import { SoundAlerts } from 'main/types';

import start from '../../assets/sounds/manual-recording-start.mp3';
import stop from '../../assets/sounds/manual-recording-stop.mp3';
import error from '../../assets/sounds/manual-recording-error.mp3';

const playAudio = (sound: unknown) => {
  if (sound === SoundAlerts.MANUAL_RECORDING_START) {
    new Audio(start).play();
  } else if (sound === SoundAlerts.MANUAL_RECORDING_STOP) {
    new Audio(stop).play();
  } else if (sound === SoundAlerts.MANUAL_RECORDING_ERROR) {
    new Audio(error).play();
  } else {
    console.warn('Unknown sound alert:', sound);
  }
};

export { playAudio };
