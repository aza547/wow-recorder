import { AppState, AudioSource, AudioSourceType } from 'main/types';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { configSchema } from 'config/configSchema';
import {
  AppWindow,
  AudioLines,
  Info,
  MicVocal,
  PlusIcon,
  Speaker,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { useSettings, setConfigValues } from './useSettings';
import {
  fetchAudioSourceChoices,
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
import { Phrase } from 'localisation/phrases';

const ipc = window.electron.ipcRenderer;
let debounceTimer: NodeJS.Timeout | undefined;

interface IProps {
  appState: AppState;
  setPreviewEnabled: Dispatch<SetStateAction<boolean>>;
}

const AudioSourceControls = (props: IProps) => {
  const { appState, setPreviewEnabled } = props;
  const { language } = appState;
  const [config, setConfig] = useSettings();
  const initialRender = useRef(true);
  const audioChoicesLoaded = useRef(false);
  const pttInputRef = useRef<HTMLInputElement>(null);

  // Available choices per source.
  const [sourceChoices, setSourceChoices] = useState<
    Record<string, ObsListItem[]>
  >({});

  // Volmeter data.
  const [sourceMagnitude, setSourceMagnitude] = useState<
    Record<string, number>
  >({});

  // Volume popover state. We only allow one to be open at a time.
  const [volumePopoverSourceId, setVolumePopoverSourceId] = useState('');

  // We will block adding new sources if we have a partially
  // configured process source (speakers and mics can both
  // default to "default" so this only effects process sources).
  let sourcesAreFullyDefined = true;

  config.audioSources.forEach((src) => {
    if (!src.device) {
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
    if (initialRender.current) {
      // Don't rewrite the config for no reason on mount.
      initialRender.current = false;
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      setConfigValues({
        audioSources: config.audioSources,
        obsAudioSuppression: config.obsAudioSuppression,
        obsForceMono: config.obsForceMono,
        pushToTalk: config.pushToTalk,
        pushToTalkKey: config.pushToTalkKey,
        pushToTalkMouseButton: config.pushToTalkMouseButton,
        pushToTalkModifiers: config.pushToTalkModifiers,
        pushToTalkReleaseDelay: config.pushToTalkReleaseDelay,
      });
    }, 500);
  }, [
    config.audioSources,
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
        pttInputRef.current?.blur();
      }
    };

    listenNextKeyPress();
  }, [pttHotKeyFieldFocused, setConfig]);

  const volmeterRefresh = (id: string, magnitude: number) => {
    // console.log('volmeter', id, magnitude);
    setSourceMagnitude((prev) => {
      prev[id] = magnitude;
      return { ...prev };
    });
  };

  // On initial load we don't know the available choices for existing
  // sources in the config, so retrieve it here.
  const initAudioSourceChoices = async () => {
    const promises = config.audioSources.map(async (s) => ({
      id: s.id,
      choices: await fetchAudioSourceChoices(s),
    }));

    const choices = await Promise.all(promises);
    const updated: Record<string, ObsListItem[]> = {};

    choices.forEach((choice) => {
      updated[choice.id] = choice.choices;
    });

    setSourceChoices(updated);
    audioChoicesLoaded.current = true;
  };

  useEffect(() => {
    ipc.on('volmeter', (id: unknown, magnitude: unknown) =>
      volmeterRefresh(id as string, magnitude as number),
    );

    const initAudioSettings = async () => {
      await ipc.audioSettingsOpen();
      await initAudioSourceChoices();
    };

    // Attach the audio devices so volmeter bars show
    // even if WoW is closed.
    initAudioSettings();

    return () => {
      ipc.removeAllListeners('volmeter');

      // Remove the audio devices so Windows can still sleep on unmounting.
      ipc.audioSettingsClosed();
    };
  }, []);

  const setForceMono = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsForceMono: checked,
      };
    });

    ipc.setForceMono(checked);
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

    ipc.setAudioSuppression(checked);
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
          ref={pttInputRef}
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

  const setSourceDevice = (src: AudioSource, device: string) => {
    const idx = config.audioSources.indexOf(src);
    if (idx === -1) return;

    const choice = sourceChoices[src.id].find((item) => item.value === device);
    if (!choice) return;

    const clone = [...config.audioSources];
    clone[idx] = { ...src, device, friendly: choice.name };

    setConfig((prev) => ({ ...prev, audioSources: clone }));

    if (src.type === AudioSourceType.PROCESS) {
      ipc.setAudioSourceWindow(src.id, device);
    } else {
      ipc.setAudioSourceDevice(src.id, device);
    }
  };

  const renderSourceType = (src: AudioSource) => {
    if (src.type === AudioSourceType.OUTPUT) {
      return (
        <div className="flex justify-center items-center  text-foreground-lighter gap-x-1">
          <Speaker />
        </div>
      );
    }

    if (src.type === AudioSourceType.INPUT) {
      return (
        <div className="flex justify-center items-center text-foreground-lighter gap-x-1">
          <MicVocal />
        </div>
      );
    }

    if (src.type === AudioSourceType.PROCESS) {
      return (
        <div className="flex justify-center items-center text-foreground-lighter gap-x-1">
          <AppWindow />
        </div>
      );
    }
  };

  const renderSourceDeviceSelect = (src: AudioSource) => {
    const choices: ObsListItem[] = [];

    if (sourceChoices[src.id]) {
      // Deduplicate on the name field.
      sourceChoices[src.id].forEach((choice) => {
        if (!choices.find((item) => item.name === choice.name)) {
          choices.push(choice);
        }
      });
    }

    const renderSelectItems = () => {
      if (!audioChoicesLoaded.current) {
        return <></>;
      }

      const found = choices.find((tt) => tt.value === src.device);

      const items = choices.map((tt) => (
        <SelectItem key={tt.name} value={String(tt.value)}>
          {tt.name}
        </SelectItem>
      ));

      // If we don't find the device currently selected add it so it
      // renders with a warning. Don't do the warning this for process
      // as it's common for the windows to change and we do exe
      // matching anyway.
      if (!found && src.device) {
        const text =
          src.type !== AudioSourceType.PROCESS
            ? `⚠ Unknown device: ${src.friendly}`
            : src.device;

        items.push(
          <SelectItem key="custom" value={src.device}>
            {text}
          </SelectItem>,
        );
      }

      return items;
    };

    return (
      <div className="flex flex-col w-[500px]">
        <Select
          value={src.device}
          onValueChange={(value) => setSourceDevice(src, value)}
          onOpenChange={(open) => setPreviewEnabled(!open)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a device...." />
          </SelectTrigger>
          <SelectContent>{renderSelectItems()}</SelectContent>
        </Select>
      </div>
    );
  };

  const removeSource = (src: AudioSource) => {
    const idx = config.audioSources.indexOf(src);
    if (idx === -1) return;

    setConfig((prev) => {
      const clone = [...prev.audioSources];
      clone.splice(idx, 1);
      return { ...prev, audioSources: clone };
    });

    setSourceChoices((prev) => {
      const clone = { ...prev };
      delete clone[src.id];
      return clone;
    });

    setSourceMagnitude((prev) => {
      const clone = { ...prev };
      delete clone[src.id];
      return clone;
    });

    setVolumePopoverSourceId('');
    ipc.deleteAudioSource(src.id);
  };

  const renderDeleteSourceButton = (src: AudioSource) => {
    return (
      <Button onClick={() => removeSource(src)} variant="ghost" size="sm">
        <X color="red" opacity={0.5} />
      </Button>
    );
  };

  const toggleVolumePopover = (src: AudioSource, open: boolean) => {
    setVolumePopoverSourceId(open ? src.id : '');
  };

  const renderSourceRow = (src: AudioSource) => {
    const idx = config.audioSources.indexOf(src);
    const val = Math.round(src.volume * 100);
    let icon;

    if (val === 0) {
      icon = <VolumeX />;
    } else if (val < 50) {
      icon = <Volume1 />;
    } else {
      icon = <Volume2 />;
    }

    const magnitude = sourceMagnitude[src.id] ?? 0;

    return (
      <tr key={idx}>
        <td className="px-2">{renderSourceType(src)}</td>
        <td className="px-2">{renderSourceDeviceSelect(src)}</td>
        <td className="px-2">
          <div className="relative h-[38px] w-[150px]">
            <Progress
              className="h-full w-full rounded-sm"
              value={100 * magnitude}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <AudioLines className="text-foreground-lighter" size={18} />
            </div>
          </div>
        </td>
        <td>
          <Popover
            open={src.id === volumePopoverSourceId}
            onOpenChange={(open) => toggleVolumePopover(src, open)}
          >
            <PopoverTrigger asChild>
              <Button variant="ghost">{icon}</Button>
            </PopoverTrigger>
            <PopoverContent className="border-bg" side="right" align="center">
              <Slider
                defaultValue={[val]}
                value={[val]}
                max={100}
                step={1}
                onValueChange={(newValue) => {
                  setConfig(() => {
                    const idx = config.audioSources.indexOf(src);
                    if (idx === -1) return config;
                    const newSources = [...config.audioSources];

                    newSources[idx] = {
                      ...newSources[idx],
                      volume: newValue[0] / 100,
                    };

                    return { ...config, audioSources: newSources };
                  });

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

  const addSource = async (type: AudioSourceType) => {
    const ids = config.audioSources.map((src) => src.id);
    let idx = 1;

    // Find the next available name.
    while (ids.includes(`WCR Audio Source ${idx}`)) {
      idx++;
    }

    const id = `WCR Audio Source ${idx}`;
    const name = await ipc.createAudioSource(id, type);
    const device = type === AudioSourceType.PROCESS ? undefined : 'default';
    const friendly = device;

    const src: AudioSource = {
      id: name, // Careful to not assume we got the name we asked for.
      type,
      friendly,
      device,
      volume: 1,
    };

    const choices = await fetchAudioSourceChoices(src);

    setConfig((prev) => ({
      ...prev,
      audioSources: [...prev.audioSources, src],
    }));

    setSourceChoices((prev) => ({
      ...prev,
      [src.id]: choices,
    }));
  };

  const renderSourceTable = () => {
    return (
      <table className="table-auto w-max">
        <tbody>
          {config.audioSources.map(renderSourceRow)}
          <tr>
            <td colSpan={5}></td>
          </tr>
        </tbody>
      </table>
    );
  };

  const renderHelpText = () => {
    return (
      <div className="flex flex-col text-sm text-foreground-lighter">
        Add a source to record audio.
      </div>
    );
  };

  const getSourcesSection = () => {
    return (
      <div className="flex flex-col gap-y-2">
        {config.audioSources.length > 0 && renderSourceTable()}
        {config.audioSources.length < 1 && renderHelpText()}
        <div className="flex gap-2 mx-2">
          <Button
            onClick={() => addSource(AudioSourceType.OUTPUT)}
            disabled={!sourcesAreFullyDefined}
            variant="outline"
          >
            <PlusIcon className="px-0" />
            {getLocalePhrase(language, Phrase.AddSpeakerButtonText)}
          </Button>
          <Button
            onClick={() => addSource(AudioSourceType.INPUT)}
            disabled={!sourcesAreFullyDefined}
            variant="outline"
          >
            <PlusIcon className="px-0" />
            {getLocalePhrase(language, Phrase.AddMicrophoneButtonText)}
          </Button>
          <Button
            onClick={() => addSource(AudioSourceType.PROCESS)}
            disabled={!sourcesAreFullyDefined}
            variant="outline"
          >
            <PlusIcon className="px-0" />
            {getLocalePhrase(language, Phrase.AddApplicationButtonText)}
          </Button>
        </div>
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
