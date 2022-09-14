const { byOS, OS } = require('./operatingSystems');
const osn = require("obs-studio-node");

class ObsAudioDevice {
  constructor (
    public id: string,
    public name: string,
  ) {};
};

/*
* getAudioDevices
*/
const getAudioDevices = (type: any, subtype: any): ObsAudioDevice[] => {
  const dummyDevice = osn.InputFactory.create(type, subtype, { device_id: 'does_not_exist' });

  const devices = dummyDevice.properties
    .get('device_id').details.items
    //@ts-ignore
    .map(({ name, value }) => new ObsAudioDevice(value, name));

  dummyDevice.release();

  return devices;
};

const getAvailableAudioInputDevices = () => {
  return getAudioDevices(
    byOS({
      [OS.Windows]: 'wasapi_input_capture',
      [OS.Mac]: 'coreaudio_input_capture'
    }),
    'mic-audio'
  )
  .filter(v => v.id !== 'default');
};

const getAvailableAudioOutputDevices = () => {
  return getAudioDevices(
    byOS({
      [OS.Windows]: 'wasapi_output_capture',
      [OS.Mac]: 'coreaudio_output_capture'
    }),
    'desktop-audio'
  )
  .filter(v => v.id !== 'default');
};

export {
  ObsAudioDevice,
  getAudioDevices,
  getAvailableAudioInputDevices,
  getAvailableAudioOutputDevices,
}
