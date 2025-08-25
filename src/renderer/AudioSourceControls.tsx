import { AppState, AudioSourceType } from 'main/types';
import { useEffect, useState } from 'react';
import { configSchema } from 'config/configSchema';
import { Info, PlusIcon, Volume, Volume1, Volume2, VolumeX, X } from 'lucide-react';
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

import { ObsListItem } from 'noobs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './components/Popover/Popover';

const ipc = window.electron.ipcRenderer;
let debounceTimer: NodeJS.Timeout | undefined;

interface IProps {
  appState: AppState;
}

type AudioSource = {
  id: string;
  type?: AudioSourceType;
  device: string;
  choices?: ObsListItem[];
  volume: number; // Current volume setting (0-1)
  volumePopoverOpen: boolean;
  magnitude: number; // Current volmeter activity (0-1)
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

  const volmeterRefresh = (id: string, magnitude: number) => {
    console.log('volmeter', id, magnitude);
    setSources((prevSources) =>
      prevSources.map((src) => (src.id === id ? { ...src, magnitude } : src)),
    );
  };

  useEffect(() => {
    ipc.on('volmeter', (id: unknown, magnitude: unknown) =>
      volmeterRefresh(id as string, magnitude as number),
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
    const properties = await ipc.createAudioSource(src.id, type);
    console.log(properties);

    const devices = properties.find(
      (prop) => prop.name === 'device_id' || prop.name === 'window',
    );

    if (!devices || devices.type !== 'list') {
      return;
    }

    const choices = devices.items;
    const clone = [...sources];
    clone[idx] = { ...src, type, choices };
    setSources(clone);
  };

  const setSourceDevice = (src: AudioSource, device: string) => {
    const idx = sources.indexOf(src);
    if (idx === -1) return;
    const clone = [...sources];
    clone[idx] = { ...src, device };
    setSources(clone);

    if (src.type === AudioSourceType.process) {
      ipc.setAudioSourceWindow(src.id, device);
    } else {
      ipc.setAudioSourceDevice(src.id, device);
    }
  };

  const renderSourceTypeSelect = (src: AudioSource) => {
    return (
      <div className="flex flex-col w-full w-[200px]">
        <Select
          onValueChange={(v) => setSourceType(src, v as AudioSourceType)}
          value={src.type}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a type..." />
          </SelectTrigger>
          <SelectContent>
            {[
              AudioSourceType.input,
              AudioSourceType.output,
              AudioSourceType.process,
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
      <div className="flex flex-col w-[500px]">
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
                <SelectItem key={tt.name} value={String(tt.value)}>
                  {tt.name}
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
    ipc.deleteAudioSource(src.id);
  };

  const renderDeleteSourceButton = (src: AudioSource) => {
    return (
      <Button
        onClick={() => removeSource(src)}
        variant="ghost"
        size="sm"
        disabled={sources.length < 1}
      >
        <X />
      </Button>
    );
  };

  const openVolumePopover = (src: AudioSource, open: boolean) => {
    // Open the selected volume popover while closing the others.
    setSources((prev) => {
      return prev.map((s) => ({
        ...s,
        volumePopoverOpen: s.id === src.id && open,
      }));
    });
  };

  const renderSourceRow = (src: AudioSource) => {
    const idx = sources.indexOf(src);
    const val = Math.round(src.volume * 100);
    let icon;

    if (val === 0) {
      icon = <VolumeX />;
    } else if (val < 50) {
      icon = <Volume1 />;
    } else {
      icon = <Volume2 />;
    }

    return (
      <tr key={idx}>
        <td className="px-2">{renderSourceTypeSelect(src)}</td>
        <td className="px-2">{renderSourceDeviceSelect(src)}</td>
        <td className="px-2">
          <Progress
            className="h-[38px] w-[150px] rounded-sm"
            value={100 * src.magnitude}
          />
        </td>
        <td>
          <Popover
            open={src.volumePopoverOpen}
            onOpenChange={(open) => openVolumePopover(src, open)}
          >
            <PopoverTrigger asChild>
              <Button variant="ghost">{icon}</Button>
            </PopoverTrigger>
            <PopoverContent className="border-card">
              <Slider
                defaultValue={[val]}
                value={[val]}
                max={100}
                step={1}
                onValueChange={(newValue) => {
                  setSources((prev) => {
                    if (typeof newValue[0] !== 'number') return prev;
                    const idx = prev.indexOf(src);
                    if (idx === -1) return prev;
                    prev[idx].volume = newValue[0] / 100;
                    return prev;
                  });

                  // TODO debounce?
                  ipc.setAudioSourceVolume(src.id, newValue[0] / 100);
                }}
              />
            </PopoverContent>
          </Popover>
        </td>
        <td>{renderDeleteSourceButton(src)}</td>
      </tr>
    );
  };

  const addSource = async () => {
    const id = `WCR Audio Source ${sources.length + 1}`;

    const src: AudioSource = {
      id,
      device: 'default',
      volume: 1,
      volumePopoverOpen: false,
      magnitude: 0,
    };

    setSources((prev) => [...prev, src]);
  };

  const renderSourceTable = () => {
    return (
      <table className="table-auto w-max">
        <thead>
          <tr>
            <th className="text-foreground-lighter text-xs">Type</th>
            <th className="text-foreground-lighter text-xs">Device</th>
            <th className="text-foreground-lighter text-xs">Activity</th>
            <th className="p-1" />
          </tr>
        </thead>
        <tbody>
          {sources.map(renderSourceRow)}
          <tr>
            <td colSpan={5} className="text-center">
              <Button
                onClick={addSource}
                variant="ghost"
                disabled={!sourcesAreFullyDefined}
              >
                <PlusIcon />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  const renderHelpText = () => {
    return (
      <div className="flex flex-col text-sm text-foreground">
        Add a source to record audio.
        <Button
          onClick={addSource}
          variant="ghost"
          disabled={!sourcesAreFullyDefined}
          className="max-w-[100px]"
        >
          <PlusIcon size={18} />
        </Button>
      </div>
    );
  };

  const getSourcesSection = () => {
    return (
      <div className="flex flex-col gap-y-2">
        {sources.length > 0 && renderSourceTable()}
        {sources.length < 1 && renderHelpText()}
      </div>
    );
  };

  const getSettingsSection = () => {
    return (
      <div className="flex gap-y-8 flex-col m-4">
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

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {getSourcesSection()}
      {getSettingsSection()}
    </div>
  );
};

export default AudioSourceControls;
