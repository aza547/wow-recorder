import * as React from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import { AppState } from 'main/types';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { setConfigValues, useSettings } from './useSettings';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';

interface IProps {
  appState: AppState;
}

const WindowsSettings = (props: IProps) => {
  const { appState } = props;
  const [config, setConfig] = useSettings();
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
    });
  }, [
    config.minimizeOnQuit,
    config.minimizeToTray,
    config.startMinimized,
    config.startUp,
  ]);

  const getSwitch = (
    preference: keyof ConfigurationSchema,
    changeFn: (checked: boolean) => void
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
    changeFn: (checked: boolean) => void
  ) => {
    return (
      <div className="flex flex-col">
        <Label htmlFor="separateBufferPath">
          {getLocalePhrase(appState.language, label)}
        </Label>
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

  return (
    <div className="flex flex-row flex-wrap gap-x-8">
      {getSwitchForm('startUp', Phrase.RunOnStartupLabel, setRunOnStartup)}
      {getSwitchForm(
        'startMinimized',
        Phrase.StartMinimizedLabel,
        setStartMinimized
      )}
      {getSwitchForm(
        'minimizeOnQuit',
        Phrase.MinimizeOnQuitLabel,
        setMinimizeOnQuit
      )}
      {getSwitchForm(
        'minimizeToTray',
        Phrase.MinimizeToTrayLabel,
        setMinimizeToTray
      )}
    </div>
  );
};

export default WindowsSettings;
