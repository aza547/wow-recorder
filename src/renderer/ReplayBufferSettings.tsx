import * as React from 'react';
import { configSchema } from 'config/configSchema';
import { AppState, RecStatus } from 'main/types';
import { useEffect, useRef, useState } from 'react';
import { History, Info } from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { setConfigValues, useSettings } from './useSettings';
import { Input } from './components/Input/Input';
import Label from './components/Label/Label';
import Switch from './components/Switch/Switch';
import { Tooltip } from './components/Tooltip/Tooltip';
import Progress from './components/Progress/Progress';
import { Phrase } from 'localisation/phrases';
import HotKeyInput from './HotKeyInput';

interface IProps {
  recorderStatus: RecStatus;
  replayBufferSeconds: number;
  appState: AppState;
}

const ipc = window.electron.ipcRenderer;
let debounceTimeout: NodeJS.Timeout | null;

const minReplayBufferSecs = configSchema.customReplayBufferLength.minimum;
const maxReplayBufferSecs = configSchema.customReplayBufferLength.maximum;

const ReplayBufferSettings: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, replayBufferSeconds, appState } = props;
  const { language } = appState;
  const [config, setConfig] = useSettings();

  const initialRender = useRef(true);

  // Local string state so the user can freely edit the field (e.g. clear it
  // to retype), only committed to the config on blur.
  const [innerBufferSecs, setInnerBufferSecs] = useState<string>(
    String(config.customReplayBufferLength),
  );

  useEffect(() => {
    if (initialRender.current) {
      // Drop out if initial render, we don't care about settings
      // changes until the user has had a chance to make some.
      initialRender.current = false;
      return;
    }

    setConfigValues({
      customReplayBuffer: config.customReplayBuffer,
      customReplayBufferLength: config.customReplayBufferLength,
    });

    // The buffer length is applied when OBS is configured.
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    debounceTimeout = setTimeout(() => {
      ipc.reconfigureBase();
    }, 500);
  }, [config.customReplayBuffer, config.customReplayBufferLength]);

  const isComponentDisabled = () => {
    const isRecording = recorderStatus === RecStatus.Recording;
    const isOverrunning = recorderStatus === RecStatus.Overrunning;
    return isRecording || isOverrunning;
  };

  const parseBufferSecs = (value: string) => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = parseInt(trimmed, 10);
    const valid =
      parsed >= minReplayBufferSecs && parsed <= maxReplayBufferSecs;
    return valid ? parsed : null;
  };

  const onBlurBufferSecs = () => {
    const secs = parseBufferSecs(innerBufferSecs);

    if (secs === null) {
      setInnerBufferSecs(String(config.customReplayBufferLength));
      return;
    }

    setInnerBufferSecs(String(secs));

    setConfig((prevState) => {
      return { ...prevState, customReplayBufferLength: secs };
    });
  };

  const onKeyDownBufferSecs = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  const getReplayBufferField = () => {
    if (isComponentDisabled() || !config.customReplayBuffer) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-40">
        <Label htmlFor="replayBufferSecs" className="flex items-center">
          {getLocalePhrase(language, Phrase.ReplayBufferLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.customReplayBufferLength.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="replayBufferSecs"
          value={innerBufferSecs}
          onChange={(e) => setInnerBufferSecs(e.target.value)}
          onBlur={onBlurBufferSecs}
          onKeyDown={onKeyDownBufferSecs}
          inputMode="numeric"
          required
          disabled={isComponentDisabled()}
        />
      </div>
    );
  };

  const setCustomReplayBuffer = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        customReplayBuffer: checked,
      };
    });
  };

  const getCustomReplayBufferSwitch = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-col">
        <Label htmlFor="customReplayBuffer" className="flex items-center">
          {getLocalePhrase(language, Phrase.CustomReplayBufferLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.customReplayBuffer.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={Boolean(config.customReplayBuffer)}
            id="customReplayBuffer"
            name="customReplayBuffer"
            onCheckedChange={setCustomReplayBuffer}
          />
        </div>
      </div>
    );
  };

  const getReplayBufferUsageBar = () => {
    const max = config.customReplayBuffer
      ? config.customReplayBufferLength
      : configSchema.customReplayBufferLength.default;

    const usage = Math.min(replayBufferSeconds, max);
    const perc = max > 0 ? (100 * usage) / max : 0;
    const text = `${usage}s / ${max}s`;

    return (
      <div className="flex-col">
        <Label className="flex items-center">
          {getLocalePhrase(language, Phrase.ActiveReplayBufferLabel)}
        </Label>

        <div className="flex flex-row items-center justify-start w-80 gap-x-2 py-2">
          <History size={24} className="text-foreground-lighter" />

          <Progress value={perc} className="h-3" />
          <span className="text-[11px] text-foreground font-semibold whitespace-nowrap">
            {text}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-row items-center gap-x-10">
        {getCustomReplayBufferSwitch()}
        {getReplayBufferField()}
        <HotKeyInput
          appState={appState}
          config={config}
          setConfig={setConfig}
          keyField="saveReplayBufferHotKey"
          modifiersField="saveReplayBufferHotKeyModifiers"
          label={Phrase.SaveReplayBufferHotKeyLabel}
          description={Phrase.SaveReplayBufferHotKeyDescription}
        />
        {getReplayBufferUsageBar()}
      </div>
    </div>
  );
};

export default ReplayBufferSettings;
