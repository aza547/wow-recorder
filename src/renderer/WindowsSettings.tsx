import * as React from 'react';
import { ConfigurationSchema, configSchema } from 'config/configSchema';
import { AppState } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { Info } from 'lucide-react';
import { setConfigValues } from './useSettings';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';
import { Dispatch, SetStateAction } from 'react';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Input } from './components/Input/Input';
import { Phrase } from 'localisation/phrases';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

const WindowsSettings = (props: IProps) => {
  const { appState, config, setConfig } = props;
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      startUp: config.startUp,
      startMinimized: config.startMinimized,
      minimizeOnQuit: config.minimizeOnQuit,
      minimizeToTray: config.minimizeToTray,
      hideEmptyCategories: config.hideEmptyCategories,
      hardwareAcceleration: config.hardwareAcceleration,
      hevcTranscodeEnabled: config.hevcTranscodeEnabled,
      hevcTranscodeCacheSizeGb: config.hevcTranscodeCacheSizeGb,
    });
  }, [
    config.minimizeOnQuit,
    config.minimizeToTray,
    config.startMinimized,
    config.startUp,
    config.hideEmptyCategories,
    config.hardwareAcceleration,
    config.hevcTranscodeEnabled,
    config.hevcTranscodeCacheSizeGb,
  ]);

  const getSwitch = (
    preference: keyof ConfigurationSchema,
    changeFn: (checked: boolean) => void,
  ) => (
    <Switch
      checked={Boolean(config[preference])}
      name={preference}
      onCheckedChange={changeFn}
    />
  );

  const getSwitchForm = (
    preference: keyof ConfigurationSchema,
    label: Phrase,
    changeFn: (checked: boolean) => void,
    info: Phrase | undefined = undefined,
  ) => {
    return (
      <div className="flex flex-col">
        {info && (
          <Tooltip
            content={getLocalePhrase(appState.language, info)}
            side="right"
          >
            <Label htmlFor="separateBufferPath">
              {getLocalePhrase(appState.language, label)}
            </Label>
          </Tooltip>
        )}
        {!info && (
          <Label htmlFor="separateBufferPath">
            {getLocalePhrase(appState.language, label)}
          </Label>
        )}

        <div className="flex h-10 items-center">
          {getSwitch(preference, changeFn)}
        </div>
      </div>
    );
  };

  const setRunOnStartup = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        startUp: checked,
      };
    });
  };

  const setStartMinimized = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        startMinimized: checked,
      };
    });
  };

  const setMinimizeOnQuit = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        minimizeOnQuit: checked,
      };
    });
  };

  const setMinimizeToTray = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        minimizeToTray: checked,
      };
    });
  };

  const setHardwareAcceleration = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        hardwareAcceleration: checked,
      };
    });
  };

  const setHevcTranscodeEnabled = (checked: boolean) => {
    if (!checked) {
      // Kill any in-flight ffmpeg jobs the user just opted out of.
      ipc.sendMessage('hevcTranscodeCancelAll', []);
    }
    setConfig((prevState) => {
      return {
        ...prevState,
        hevcTranscodeEnabled: checked,
      };
    });
  };

  const setHevcTranscodeCacheSizeGb = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const hevcTranscodeCacheSizeGb = parseInt(event.target.value, 10);
    if (Number.isNaN(hevcTranscodeCacheSizeGb) || hevcTranscodeCacheSizeGb < 0)
      return;
    setConfig((prevState) => {
      return {
        ...prevState,
        hevcTranscodeCacheSizeGb,
      };
    });
  };

  // Linux-only: Chromium on Windows decodes HEVC natively with HW accel.
  const renderHevcTranscodeControls = () => {
    if (!appState.isLinux) return null;
    return (
      <>
        <div className="flex flex-col">
          <Label htmlFor="hevcTranscodeEnabled" className="flex items-center">
            {getLocalePhrase(
              appState.language,
              Phrase.HevcTranscodeEnabledLabel,
            )}
            <Tooltip
              content={getLocalePhrase(
                appState.language,
                Phrase.HevcTranscodeEnabledDescription,
              )}
              side="top"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch('hevcTranscodeEnabled', setHevcTranscodeEnabled)}
          </div>
        </div>
        {config.hevcTranscodeEnabled && (
          <div className="flex flex-col w-40">
            <Label
              htmlFor="hevcTranscodeCacheSizeGb"
              className="flex items-center"
            >
              {getLocalePhrase(
                appState.language,
                Phrase.HevcTranscodeCacheSizeGbLabel,
              )}
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  Phrase.HevcTranscodeCacheSizeGbDescription,
                )}
                side="top"
              >
                <Info size={20} className="inline-flex ml-2" />
              </Tooltip>
            </Label>
            <Input
              name="hevcTranscodeCacheSizeGb"
              value={config.hevcTranscodeCacheSizeGb}
              onChange={setHevcTranscodeCacheSizeGb}
              spellCheck={false}
              type="numeric"
            />
            {config.hevcTranscodeCacheSizeGb < 1 && (
              <span className="text-error text-xs font-semibold mt-1">
                {getLocalePhrase(appState.language, Phrase.OneOrGreater)}
              </span>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-row flex-wrap gap-x-8 gap-y-4">
      {getSwitchForm('startUp', Phrase.RunOnStartupLabel, setRunOnStartup)}
      {getSwitchForm(
        'startMinimized',
        Phrase.StartMinimizedLabel,
        setStartMinimized,
      )}
      {getSwitchForm(
        'minimizeOnQuit',
        Phrase.MinimizeOnQuitLabel,
        setMinimizeOnQuit,
      )}
      {getSwitchForm(
        'minimizeToTray',
        Phrase.MinimizeToTrayLabel,
        setMinimizeToTray,
      )}
      {getSwitchForm(
        'hardwareAcceleration',
        Phrase.HardwareAccelerationLabel,
        setHardwareAcceleration,
        Phrase.HardwareAccelerationDescription,
      )}
      {renderHevcTranscodeControls()}
    </div>
  );
};

export default WindowsSettings;
