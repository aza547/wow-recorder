import { DeviceType, IOBSDevice } from 'main/types';
import React from 'react';
import { configSchema } from 'main/configSchema';
import { Info, Volume1, Volume2 } from 'lucide-react';
import { useSettings, setConfigValues } from './useSettings';
import {
  blurAll,
  getKeyByValue,
  getKeyModifiersString,
  getNextKeyOrMouseEvent,
  getPTTKeyPressEventFromConfig,
  standardizeAudioDeviceNames,
} from './rendererutils';
import { PTTKeyPressEvent, UiohookKeyMap } from '../types/KeyTypesUIOHook';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import { MultiSelect } from './components/MultiSelect/MultiSelect';
import Slider from './components/Slider/Slider';
import Switch from './components/Switch/Switch';
import { Input } from './components/Input/Input';

const ipc = window.electron.ipcRenderer;
let debounceTimer: NodeJS.Timer | undefined;

const AudioSourceControls: React.FC = () => {
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

  const [audioDevices, setAudioDevices] = React.useState<{
    input: IOBSDevice[];
    output: IOBSDevice[];
  }>({ input: [], output: [] });

  const [pttHotKeyFieldFocused, setPttHotKeyFieldFocused] =
    React.useState(false);

  const [pttHotKey, setPttHotKey] = React.useState<PTTKeyPressEvent>(
    getPTTKeyPressEventFromConfig(config)
  );

  React.useEffect(() => {
    const getAvailableAudioDevices = async () => {
      const devices = await ipc.invoke('getAudioDevices', []);
      setAudioDevices(devices);
    };

    getAvailableAudioDevices();

    // The reset of this effect handles config changes, so if it's the
    // initial render then just return here.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      setConfigValues({
        audioOutputDevices: config.audioOutputDevices,
        speakerVolume: config.speakerVolume,
        audioInputDevices: config.audioInputDevices,
        micVolume: config.micVolume,
        obsForceMono: config.obsForceMono,
        pushToTalk: config.pushToTalk,
        pushToTalkKey: config.pushToTalkKey,
        pushToTalkMouseButton: config.pushToTalkMouseButton,
        pushToTalkModifiers: config.pushToTalkModifiers,
        obsAudioSuppression: config.obsAudioSuppression,
      });

      ipc.sendMessage('settingsChange', []);
    }, 500);
  }, [
    config.audioOutputDevices,
    config.speakerVolume,
    config.audioInputDevices,
    config.micVolume,
    config.obsForceMono,
    config.pushToTalk,
    config.pushToTalkKey,
    config.pushToTalkMouseButton,
    config.pushToTalkModifiers,
    config.obsAudioSuppression,
  ]);

  React.useEffect(() => {
    const setPushToTalkKey = (event: PTTKeyPressEvent) => {
      setConfig((prevState) => {
        return {
          ...prevState,
          pushToTalkKey: event.keyCode,
          pushToTalkMouseButton: event.mouseButton,
          pushToTalkModifiers: getKeyModifiersString(event),
        };
      });
    };

    const listenNextKeyPress = async () => {
      if (pttHotKeyFieldFocused) {
        const keyPressEvent = await getNextKeyOrMouseEvent();
        setPttHotKeyFieldFocused(false);
        setPttHotKey(keyPressEvent);
        setPushToTalkKey(keyPressEvent);
        blurAll(document);
      }
    };

    listenNextKeyPress();
  }, [pttHotKeyFieldFocused, setConfig]);

  const input = standardizeAudioDeviceNames(
    config.audioInputDevices,
    audioDevices
  );

  const output = standardizeAudioDeviceNames(
    config.audioOutputDevices,
    audioDevices
  );

  const onDeviceChange = (type: DeviceType, values: string[]) => {
    const standardizedValues = standardizeAudioDeviceNames(
      values,
      audioDevices
    ).join();
    if (type === DeviceType.INPUT) {
      setConfig((prevState) => {
        return {
          ...prevState,
          audioInputDevices: standardizedValues,
        };
      });
    } else {
      setConfig((prevState) => {
        return {
          ...prevState,
          audioOutputDevices: standardizedValues,
        };
      });
    }
  };

  const getSpeakerSelect = () => {
    return (
      <div className="flex flex-col w-full">
        <Label className="flex items-center">
          Speakers
          <Tooltip
            content={configSchema.audioOutputDevices.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <MultiSelect
          options={audioDevices.output.map((audioDevice) => ({
            value: audioDevice.id,
            label: audioDevice.description,
          }))}
          onValueChange={(values) => onDeviceChange(DeviceType.OUTPUT, values)}
          defaultValue={output}
          placeholder="Select an output device"
          maxCount={1}
        />
      </div>
    );
  };

  const setSpeakerVolume = (newValue: number[]) => {
    if (typeof newValue[0] !== 'number') {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        speakerVolume: newValue[0] / 100,
      };
    });
  };

  const getSpeakerVolume = () => {
    return (
      <div className="w-full flex gap-x-2 items-center">
        <Volume1 />
        <Slider
          defaultValue={[config.speakerVolume * 100]}
          value={[config.speakerVolume * 100]}
          max={100}
          step={1}
          onValueChange={setSpeakerVolume}
          withTooltip={false}
        />
        <Volume2 />
      </div>
    );
  };

  const getMicSelect = () => {
    return (
      <div className="flex flex-col w-full">
        <Label className="flex items-center">
          Microphones
          <Tooltip
            content={configSchema.audioInputDevices.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <MultiSelect
          options={audioDevices.input.map((audioDevice) => ({
            value: audioDevice.id,
            label: audioDevice.description,
          }))}
          onValueChange={(values) => onDeviceChange(DeviceType.INPUT, values)}
          defaultValue={input}
          placeholder="Select an input device"
          maxCount={1}
        />
      </div>
    );
  };

  const setMicVolume = (newValue: number[]) => {
    if (typeof newValue[0] !== 'number') {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        micVolume: newValue[0] / 100,
      };
    });
  };

  const getMicVolume = () => {
    return (
      <div className="w-full flex gap-x-2 items-center">
        <Volume1 />
        <Slider
          defaultValue={[config.micVolume * 100]}
          value={[config.micVolume * 100]}
          max={100}
          step={1}
          onValueChange={setMicVolume}
          withTooltip={false}
        />
        <Volume2 />
      </div>
    );
  };

  const setForceMono = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsForceMono: checked,
      };
    });
  };

  const setPushToTalk = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        pushToTalk: checked,
      };
    });
  };

  const setAudioSuppression = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsAudioSuppression: checked,
      };
    });
  };

  const getMonoSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label className="flex items-center">
          Mono Input
          <Tooltip content={configSchema.obsForceMono.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={config.obsForceMono}
            onCheckedChange={setForceMono}
          />
        </div>
      </div>
    );
  };

  const getPushToTalkSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label className="flex items-center">
          Push to Talk
          <Tooltip content={configSchema.pushToTalk.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch checked={config.pushToTalk} onCheckedChange={setPushToTalk} />
        </div>
      </div>
    );
  };

  const getKeyPressEventString = (event: PTTKeyPressEvent) => {
    const keys: string[] = [];

    if (event.altKey) keys.push('Alt');
    if (event.ctrlKey) keys.push('Ctrl');
    if (event.shiftKey) keys.push('Shift');
    if (event.metaKey) keys.push('Win');

    const { keyCode, mouseButton } = event;

    if (keyCode > 0) {
      const key = getKeyByValue(UiohookKeyMap, keyCode);
      if (key !== undefined) keys.push(key);
    } else if (mouseButton > 0) {
      keys.push(`Mouse ${event.mouseButton}`);
    }

    return keys.join('+');
  };

  const getHotkeyString = () => {
    if (pttHotKeyFieldFocused) {
      return 'Press any key combination...';
    }

    if (pttHotKey !== null) {
      return `${getKeyPressEventString(pttHotKey)} (Click to re-bind)`;
    }

    return 'Click to bind';
  };

  const getPushToTalkSelect = () => {
    return (
      <div className="flex flex-col">
        <Label htmlFor="pttKey" className="flex items-center">
          Push to Talk Key
          <Tooltip content={configSchema.pushToTalkKey.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="pttKey"
          value={getHotkeyString()}
          onFocus={() => setPttHotKeyFieldFocused(true)}
          onBlur={() => setPttHotKeyFieldFocused(false)}
        />
      </div>
    );
  };

  const getAudioSuppressionSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label className="flex items-center">
          Audio Suppression
          <Tooltip
            content={configSchema.obsAudioSuppression.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={config.obsAudioSuppression}
            onCheckedChange={setAudioSuppression}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center content-start w-full gap-10 flex-wrap">
      <div className="flex flex-col justify-center w-1/4 gap-y-4">
        {getSpeakerSelect()}
        {getSpeakerVolume()}
      </div>
      <div className="flex flex-col justify-center w-1/4 gap-y-4">
        {getMicSelect()}
        {getMicVolume()}
      </div>
      {getAudioSuppressionSwitch()}
      {getMonoSwitch()}
      {getPushToTalkSwitch()}
      {config.pushToTalk && getPushToTalkSelect()}
    </div>
  );
};

export default AudioSourceControls;
