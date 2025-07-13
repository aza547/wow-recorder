import {
  AppState,
  DeviceType,
  IOBSDevice,
  ObsVolmeterCallbackInfo,
} from 'main/types';
import { useEffect, useRef, useState } from 'react';
import { configSchema } from 'config/configSchema';
import { Info, Volume1, Volume2 } from 'lucide-react';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { useSettings, setConfigValues } from './useSettings';
import {
  blurAll,
  getKeyByValue,
  getKeyModifiersString,
  getNextKeyOrMouseEvent,
  getPTTKeyPressEventFromConfig,
} from './rendererutils';
import { PTTKeyPressEvent, UiohookKeyMap } from '../types/KeyTypesUIOHook';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import { MultiSelect } from './components/MultiSelect/MultiSelect';
import Slider from './components/Slider/Slider';
import Switch from './components/Switch/Switch';
import { Input } from './components/Input/Input';
import Progress from './components/Progress/Progress';

const ipc = window.electron.ipcRenderer;
let debounceTimer: NodeJS.Timeout | undefined;

interface IProps {
  appState: AppState;
}

const AudioSourceControls = (props: IProps) => {
  const { appState } = props;
  const [config, setConfig] = useSettings();
  const initialRender = useRef(true);

  const [availableAudioDevices, setAvailableAudioDevices] = useState<{
    input: IOBSDevice[];
    output: IOBSDevice[];
    process: {
      name: string;
      value: string | number;
    }[];
  }>({ input: [], output: [], process: [] });

  const [volmeter, setVolmeter] = useState({
    input: 50,
    output: 30,
    process: 70,
  });

  const [pttHotKeyFieldFocused, setPttHotKeyFieldFocused] = useState(false);

  const [pttHotKey, setPttHotKey] = useState<PTTKeyPressEvent>(
    getPTTKeyPressEventFromConfig(config),
  );

  const [localReleaseDelay, setLocalReleaseDelay] = useState(
    config.pushToTalkReleaseDelay,
  );

  useEffect(() => {
    if (initialRender.current) {
      const getAvailableAudioDevices = async () => {
        const devices = await ipc.invoke('getAudioDevices', []);
        setAvailableAudioDevices(devices);
      };

      getAvailableAudioDevices();

      // The rest of this effect handles config changes, so if it's the
      // initial render then just return here.
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
        audioProcessDevices: config.audioProcessDevices,
        processVolume: config.processVolume,
        obsForceMono: config.obsForceMono,
        pushToTalk: config.pushToTalk,
        pushToTalkKey: config.pushToTalkKey,
        pushToTalkMouseButton: config.pushToTalkMouseButton,
        pushToTalkModifiers: config.pushToTalkModifiers,
        pushToTalkReleaseDelay: config.pushToTalkReleaseDelay,
        obsAudioSuppression: config.obsAudioSuppression,
      });

      ipc.sendMessage('settingsChange', []);
    }, 500);
  }, [
    config.audioOutputDevices,
    config.speakerVolume,
    config.audioInputDevices,
    config.micVolume,
    config.audioProcessDevices,
    config.processVolume,
    config.obsForceMono,
    config.pushToTalk,
    config.pushToTalkKey,
    config.pushToTalkMouseButton,
    config.pushToTalkModifiers,
    config.pushToTalkReleaseDelay,
    config.obsAudioSuppression,
  ]);

  useEffect(() => {
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

  const getSourceAverageMagnitude = (
    data: ObsVolmeterCallbackInfo[],
    prefix: string,
  ) => {
    const magnitudes = data
      .filter((d) => d.sourceName.startsWith(prefix))
      .flatMap((d) => d.magnitude);

    // OBS returns data in dBFS, which is a logarithmic scale. 0dBFS is the
    // maximum level, and approximately -100dBFS is silence. Add 100 roughly
    // convert it to a percentage.
    const length = magnitudes.length;
    if (length === 0) return -100;

    const average =
      magnitudes
        // Sometimes OBS returns magintudes of -65k. Not sure why but clamp it
        // to avoid messing with the average. Both -65k and -100 are silence.
        // Also clamp to 0 to avoid any unexpected positive values, just
        // being cautious with that, no actual evidence of this happening.
        .map((m) => Math.max(m, -100))
        .map((m) => Math.min(m, 0))
        .reduce((a, b) => a + b, 0) / length;

    return average;
  };

  const volmeterRefresh = (data: ObsVolmeterCallbackInfo[]) => {
    const speakers = getSourceAverageMagnitude(data, 'WCR Speaker Source');
    const mics = getSourceAverageMagnitude(data, 'WCR Mic Source');
    const processes = getSourceAverageMagnitude(data, 'WCR App Source');

    // We've clamped between -100 and 0. Very lazy maths here to convert it
    // to a value between 0 and 100, to use as a position on the progress bar.
    setVolmeter({
      output: speakers + 100,
      input: mics + 100,
      process: processes + 100,
    });
  };

  useEffect(() => {
    ipc.on('volmeter', (data: unknown) =>
      volmeterRefresh(data as ObsVolmeterCallbackInfo[]),
    );

    // Attach the audio devices so volmeter bars show
    // even if WoW is closed.
    ipc.sendMessage('audioSettingsOpen', [true]);

    return () => {
      ipc.removeAllListeners('volmeter');

      // Remove the audio devices so Windows can still
      // sleep on unmounting.
      ipc.sendMessage('audioSettingsOpen', [false]);
    };
  }, []);

  const onDeviceChange = (
    type: DeviceType,
    values: string[] | { value: string; label: string }[],
  ) => {
    setConfig((previous) => {
      const updated = { ...previous };

      switch (type) {
        case DeviceType.INPUT:
          updated.audioInputDevices = values.filter((d) => d).join(',');
          break;
        case DeviceType.OUTPUT:
          updated.audioOutputDevices = values.filter((d) => d).join(',');
          break;
        default:
          throw new Error('Invalid device type');
      }

      return updated;
    });
  };

  const onProcessChange = (
    values: string[], // The newly selected settings.
    options: { value: string; label: string }[], // The available options.
  ) => {
    const updated = options.filter((p) => values.includes(p.value));

    setConfig((previous) => ({
      ...previous,
      audioProcessDevices: updated,
    }));
  };

  const getSpeakerSelect = () => {
    const options = availableAudioDevices.output.map((audioDevice) => ({
      value: audioDevice.id,
      label: audioDevice.description,
    }));

    config.audioOutputDevices
      .split(',')
      .filter((id) => id)
      .forEach((id) => {
        const found = options.find((o) => o.value === id);

        if (!found) {
          options.push({ value: id, label: 'Unknown Device' });
        }
      });

    return (
      <div className="flex flex-col w-full">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.SpeakersLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.audioOutputDevices.description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <MultiSelect
          options={options}
          onValueChange={(values) => onDeviceChange(DeviceType.OUTPUT, values)}
          defaultValue={config.audioOutputDevices.split(',').filter((d) => d)}
          placeholder={getLocalePhrase(
            appState.language,
            Phrase.SelectAnOutputDevice,
          )}
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
    const options = availableAudioDevices.input.map((audioDevice) => ({
      value: audioDevice.id,
      label: audioDevice.description,
    }));

    config.audioInputDevices
      .split(',')
      .filter((id) => id)
      .forEach((id) => {
        const found = options.find((o) => o.value === id);

        if (!found) {
          options.push({ value: id, label: 'Unknown Device' });
        }
      });

    return (
      <div className="flex flex-col w-full">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.MicrophonesLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.audioInputDevices.description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <MultiSelect
          options={options}
          onValueChange={(values) => onDeviceChange(DeviceType.INPUT, values)}
          defaultValue={config.audioInputDevices.split(',').filter((d) => d)}
          placeholder={getLocalePhrase(
            appState.language,
            Phrase.SelectAnInputDevice,
          )}
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

  const getProcessSelect = () => {
    // Add any options that are stored in config. They may still be valid, in
    // the event of a window name change. Reminder: OBS will match by name and
    // then Window type. They may also be invalid, in which case we want to
    // allow a user to deselect them.
    const options = [...config.audioProcessDevices];

    // Now add any devices we know about. We don't want to add duplicates, so
    // check if the option already exists in the currently selected devices.
    availableAudioDevices.process
      .map((w) => ({ value: String(w.value), label: w.name }))
      .filter((avail) => !options.map((o) => o.value).includes(avail.value))
      .forEach((dedup) => options.push(dedup));

    // Sort alphabetically by label.
    options.sort((w1, w2) => w1.label.localeCompare(w2.label));

    return (
      <div className="flex flex-col w-full">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.ProcessesLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.audioProcessDevices.description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <MultiSelect
          options={options}
          onValueChange={(values) => onProcessChange(values, options)}
          defaultValue={config.audioProcessDevices.map((d) => d.value)}
          placeholder={getLocalePhrase(appState.language, Phrase.SelectProcess)}
          maxCount={1}
        />
      </div>
    );
  };

  const setProcessVolume = (newValue: number[]) => {
    if (typeof newValue[0] !== 'number') {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        processVolume: newValue[0] / 100,
      };
    });
  };

  const getProcessVolume = () => {
    return (
      <div className="w-full flex gap-x-2 items-center">
        <Volume1 />
        <Slider
          defaultValue={[config.processVolume * 100]}
          value={[config.processVolume * 100]}
          max={100}
          step={1}
          onValueChange={setProcessVolume}
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
          {getLocalePhrase(appState.language, Phrase.MonoInputLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.obsForceMono.description,
            )}
            side="right"
          >
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
          {getLocalePhrase(appState.language, Phrase.PushToTalkLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.pushToTalk.description,
            )}
            side="right"
          >
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
      keys.push(
        `${getLocalePhrase(appState.language, Phrase.Mouse)} ${
          event.mouseButton
        }`,
      );
    }

    return keys.join('+');
  };

  const getHotkeyString = () => {
    if (pttHotKeyFieldFocused) {
      return getLocalePhrase(appState.language, Phrase.PressAnyKeyCombination);
    }

    if (pttHotKey !== null) {
      return `${getKeyPressEventString(pttHotKey)} (${getLocalePhrase(
        appState.language,
        Phrase.ClickToRebind,
      )})`;
    }

    return getLocalePhrase(appState.language, Phrase.ClickToBind);
  };

  const getPushToTalkSelect = () => {
    return (
      <div className="flex flex-col">
        <Label htmlFor="pttKey" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.PushToTalkKeyLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.pushToTalkKey.description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="pttKey"
          value={getHotkeyString()}
          onFocus={() => setPttHotKeyFieldFocused(true)}
          onBlur={() => setPttHotKeyFieldFocused(false)}
          readOnly
        />
      </div>
    );
  };

  const getAudioSuppressionSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.AudioSuppressionLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.obsAudioSuppression.description,
            )}
            side="right"
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

  const getSpeakerSection = () => (
    <div className="flex flex-col justify-center w-1/4 gap-y-2">
      {getSpeakerSelect()}
      <div className="flex items-center">
        <Progress className="h-1 mt-1 w-full" value={volmeter.output} />
      </div>
      {getSpeakerVolume()}
    </div>
  );

  const getMicSection = () => (
    <div className="flex flex-col justify-center w-1/4 gap-y-2">
      {getMicSelect()}
      <div className="flex items-center gap-2">
        <Progress className="h-1 mt-1 w-full" value={volmeter.input} />
      </div>
      {getMicVolume()}
    </div>
  );

  const getProcessSection = () => (
    <div className="flex flex-col justify-center w-1/4 gap-y-2">
      {getProcessSelect()}
      <div className="flex items-center gap-2">
        <Progress className="h-1 mt-1 w-full" value={volmeter.process} />
      </div>
      {getProcessVolume()}
    </div>
  );

  useEffect(() => {
    setLocalReleaseDelay(config.pushToTalkReleaseDelay);
  }, [config.pushToTalkReleaseDelay]);

  const commitReleaseDelay = (newValue: number[]) => {
    const ms = newValue[0];
    if (typeof ms !== 'number') return;
    setConfig((prev) => ({ ...prev, pushToTalkReleaseDelay: ms }));
  };

  const getPushToTalkReleaseDelaySlider = () => (
    <div className="flex flex-col w-[300px]">
      <Label className="flex items-center">
        {getLocalePhrase(appState.language, Phrase.PushToTalkReleaseDelayLabel)}
        <Tooltip
          content={getLocalePhrase(
            appState.language,
            configSchema.pushToTalkReleaseDelay.description,
          )}
          side="right"
        >
          <Info size={20} className="inline-flex ml-2" />
        </Tooltip>
      </Label>
      <div className="flex h-10 items-center gap-x-2 text-foreground-lighter">
        <Slider
          id="release-delay-slider"
          value={[localReleaseDelay]}
          onValueChange={(vals) => setLocalReleaseDelay(vals[0])}
          onValueCommit={commitReleaseDelay}
          min={0}
          max={2000}
          step={1}
          withTooltip={false}
          className="flex-1"
        />
        <span className="text-sm text-foreground-lighter tabular-nums min-w-[60px] text-right whitespace-nowrap">
          {localReleaseDelay > 999
            ? `${(localReleaseDelay / 1000).toFixed(2)}s`
            : `${localReleaseDelay} ms`}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex gap-y-10 flex-col">
      <div className="flex items-center content-start w-full gap-10 flex-wrap">
        {getSpeakerSection()}
        {getMicSection()}
        {getProcessSection()}
      </div>
      <div className="flex items-center content-start w-full gap-10 flex-wrap">
        {getAudioSuppressionSwitch()}
        {getMonoSwitch()}
        {getPushToTalkSwitch()}
        {config.pushToTalk && (
          <>
            {getPushToTalkSelect()}
            {getPushToTalkReleaseDelaySlider()}
          </>
        )}
      </div>
    </div>
  );
};

export default AudioSourceControls;
