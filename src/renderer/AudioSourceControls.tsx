import { AppState } from 'main/types';
import { useEffect, useState } from 'react';
import { configSchema } from 'config/configSchema';
import { Info, PlusIcon, Volume1, Volume2, X } from 'lucide-react';
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
import Slider from './components/Slider/Slider';
import Switch from './components/Switch/Switch';
import { Input } from './components/Input/Input';
import Progress from './components/Progress/Progress';
import { Button } from './components/Button/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/Select/Select';

const ipc = window.electron.ipcRenderer;
let debounceTimer: NodeJS.Timeout | undefined;

interface IProps {
  appState: AppState;
}

enum AudioSourceType {
  INPUT = 'Input',
  OUTPUT = 'Output',
  PROCESS = 'Process',
}

type AudioSource = {
  type?: AudioSourceType;
  device?: string;
  choices?: string[];
};

const AudioSourceControls = (props: IProps) => {
  const { appState } = props;
  const [config, setConfig] = useSettings();

  const [sources, setSources] = useState<AudioSource[]>([]);
  let sourcesAreFullyDefined = true;

  sources.forEach((src) => {
    if (!src.type || !src.device) {
      sourcesAreFullyDefined = false;
    }
  });

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

  const getSourceMagnitude = (data: Record<string, number>, prefix: string) => {
    const magnitudes = Object.entries(data)
      .filter((d) => d[0].startsWith(prefix))
      .map((d) => d[1]);

    return Math.max(...magnitudes, 0);
  };

  const volmeterRefresh = (data: Record<string, number>) => {
    const speakers = getSourceMagnitude(data, 'WCR Speaker Source');
    const mics = getSourceMagnitude(data, 'WCR Mic Source');
    const processes = getSourceMagnitude(data, 'WCR Process Source');

    setVolmeter({
      output: speakers * 100,
      input: mics * 100,
      process: processes * 100,
    });
  };

  useEffect(() => {
    ipc.on('volmeter', (value: unknown) =>
      volmeterRefresh(value as Record<string, number>),
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
      <div className="flex flex-col">
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
    <div className="flex flex-col justify-center w-1/4">
      <Label className="flex items-center">
        Speaker Volume
        <Tooltip content={'Speaker Volume'} side="right">
          <Info size={20} className="inline-flex ml-2" />
        </Tooltip>
      </Label>
      <div className="flex items-center pb-2">
        <Progress
          className="h-3 mt-1 w-full rounded-sm"
          value={volmeter.output}
        />
      </div>
    </div>
  );

  const getMicSection = () => (
    <div className="flex flex-col justify-center w-1/4">
      <Label className="flex items-center">
        Mic Volume
        <Tooltip content={'Mic Volume'} side="right">
          <Info size={20} className="inline-flex ml-2" />
        </Tooltip>
      </Label>
      <div className="flex items-center pb-2">
        <Progress
          className="h-3 mt-1 w-full rounded-sm"
          value={volmeter.input}
        />
      </div>
    </div>
  );

  const getProcessSection = () => (
    <div className="flex flex-col justify-center w-1/4">
      <Label className="flex items-center">
        Application Volume
        <Tooltip content={'App Volume'} side="right">
          <Info size={20} className="inline-flex ml-2" />
        </Tooltip>
      </Label>
      <div className="flex items-center gap-2 pb-2">
        <Progress
          className="h-3 mt-1 w-full rounded-sm"
          value={volmeter.process}
        />
      </div>
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
          key={`release-delay-${config.pushToTalkReleaseDelay}`}
          defaultValue={[config.pushToTalkReleaseDelay]}
          value={[localReleaseDelay]}
          onValueChange={(vals) => setLocalReleaseDelay(vals[0])}
          onValueCommit={commitReleaseDelay}
          min={0}
          max={2000}
          step={1}
          withTooltip={false}
          className="w-[80px]"
        />
        <span className="text-sm text-foreground-lighter tabular-nums min-w-[60px] text-right whitespace-nowrap">
          {localReleaseDelay > 999
            ? `${(localReleaseDelay / 1000).toFixed(2)}s`
            : `${localReleaseDelay} ms`}
        </span>
      </div>
    </div>
  );

  const setSourceType = async (src: AudioSource, type: AudioSourceType) => {
    const idx = sources.indexOf(src);

    const props = await ipc.invoke('createAudioSource', [type]);

    const devices = props.find(
      (prop) => prop.name === 'device_id' || prop.name === 'window',
    );
    const choices = devices.items.map((item) => item.name);

    const clone = [...sources];

    if (clone.length === 0) {
      clone.push({ type, choices });
    } else {
      clone[idx] = { ...src, type, choices };
    }
    clone[idx] = { ...src, type, choices };
    setSources(clone);
  };

  const setSourceDevice = (src: AudioSource, device: string) => {
    const idx = sources.indexOf(src);
    if (idx === -1) return;
    const clone = [...sources];
    clone[idx] = { ...src, device };
    setSources(clone);
  };

  const renderSourceTypeSelect = (src: AudioSource) => {
    return (
      <div className="flex flex-col w-full">
        <Select
          onValueChange={(v) => setSourceType(src, v as AudioSourceType)}
          value={src.type}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a type..." />
          </SelectTrigger>
          <SelectContent>
            {[
              AudioSourceType.INPUT,
              AudioSourceType.OUTPUT,
              AudioSourceType.PROCESS,
            ].map((tt) => (
              <SelectItem key={tt} value={tt}>
                {tt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderSourceDeviceSelect = (src: AudioSource) => {
    return (
      <div className="flex flex-col w-full">
        <Select
          onValueChange={(value) => {
            setSourceDevice(src, value);
          }}
          value={src.device}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a device...." />
          </SelectTrigger>
          <SelectContent className="max-h-[200px] overflow-y-auto">
            {src.choices &&
              src.choices.map((tt) => (
                <SelectItem key={tt} value={tt}>
                  {tt}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const removeSource = (src: AudioSource) => {
    const idx = sources.indexOf(src);
    if (idx === -1) return;
    setSources((prev) => {
      return prev.filter((_, i) => i !== idx);
    });
  };

  const renderDeleteSourceButton = (src: AudioSource) => {
    return (
      <Button
        onClick={() => removeSource(src)}
        variant="ghost"
        size="sm"
        disabled={sources.length < 1}
      >
        <X size={18} />
      </Button>
    );
  };

  const renderSourceRow = (src: AudioSource) => {
    const idx = sources.indexOf(src);

    return (
      <tr key={idx}>
        <td className="px-1">{renderSourceTypeSelect(src)}</td>
        <td className="px-1">{renderSourceDeviceSelect(src)}</td>
        <td className="px-1">{renderDeleteSourceButton(src)}</td>
      </tr>
    );
  };

  const addSource = async () => {
    const newSource: AudioSource = {};
    setSources((prev) => [...prev, newSource]);
  };

  const renderSourceTable = () => {
    return (
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th className="w-1/3 text-foreground-lighter text-xs">Type</th>
            <th className="w-2/3 text-foreground-lighter text-xs">Device</th>
            <th className="w-[20px] p-1" />
          </tr>
        </thead>
        <tbody>{sources.map(renderSourceRow)}</tbody>
      </table>
    );
  };

  const renderHelpText = () => {
    return (
      <div className="text-sm text-foreground">
        Add a source to get started.
      </div>
    );
  };

  const getSourcesSection = () => {
    return (
      <div className="flex flex-col gap-y-2 w-full">
        <Label>
          <div className="flex items-center">
            Audio Sources
            <Tooltip
              content={
                'TODO: Placeholder for audio sources. You can add, remove, and configure them.'
              }
              side="right"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </div>
        </Label>
        {sources.length > 0 && renderSourceTable()}
        {sources.length < 1 && renderHelpText()}
        <div className="flex items-center justify-center w-full">
          <Button
            onClick={addSource}
            className="mx-2"
            variant="ghost"
            disabled={!sourcesAreFullyDefined} // Don't allow adding a new source if any existing source is not fully defined.
          >
            <PlusIcon size={18} />
          </Button>
        </div>
      </div>
    );
  };

  const getSettingsSection = () => {
    return (
      <div className="flex gap-y-8 flex-col">
        <div className="flex items-center content-start w-full gap-10 flex-wrap">
          {getSpeakerSection()}
          {getMicSection()}
          {getProcessSection()}
        </div>
        <div className="flex items-center content-start w-full gap-10 flex-wrap">
          {getAudioSuppressionSwitch()}
          {getMonoSwitch()}
        </div>
        <div className="flex items-center content-start w-full gap-10 flex-wrap">
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

  return (
    <div className="flex flex-row w-full h-full gap-4">
      <div className="w-[40%] flex flex-col">{getSourcesSection()}</div>
      <div className="w-px bg-card mx-2" />
      <div className="w-[60%] flex flex-col">{getSettingsSection()}</div>
    </div>
  );
};

export default AudioSourceControls;
