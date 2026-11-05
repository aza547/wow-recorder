import { configSchema, ConfigurationSchema } from 'config/configSchema';
import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { setConfigValues } from './useSettings';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';
import { Phrase } from 'localisation/phrases';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Info } from 'lucide-react';
import { Input } from './components/Input/Input';
import HotKeyInput from './HotKeyInput';

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

const ManualSettings = (props: IProps) => {
  const { appState, config, setConfig } = props;
  const initialRender = useRef(true);

  useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      manualRecord: config.manualRecord,
      manualRecordHotKey: config.manualRecordHotKey,
      manualRecordHotKeyModifiers: config.manualRecordHotKeyModifiers,
      manualRecordSoundAlert: config.manualRecordSoundAlert,
    });
  }, [
    config.manualRecord,
    config.manualRecordHotKey,
    config.manualRecordHotKeyModifiers,
    config.manualRecordSoundAlert,
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
  ) => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor={preference} className="flex items-center">
          {getLocalePhrase(appState.language, label)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema[preference].description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch(preference, changeFn)}
        </div>
      </div>
    );
  };

  const setRecordManual = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        manualRecord: checked,
      };
    });
  };

  const setSoundAlert = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        manualRecordSoundAlert: checked,
      };
    });
  };

  return (
    <div className="flex flex-row flex-wrap gap-x-4 gap-y-2">
      {getSwitchForm(
        'manualRecord',
        Phrase.ManualRecordSwitchLabel,
        setRecordManual,
      )}

      {config.manualRecord &&
        getSwitchForm(
          'manualRecordSoundAlert',
          Phrase.ManualRecordSoundAlertLabel,
          setSoundAlert,
        )}

      {config.manualRecord && (
        <>
          <HotKeyInput
            appState={appState}
            config={config}
            setConfig={setConfig}
            keyField="manualRecordHotKey"
            modifiersField="manualRecordHotKeyModifiers"
            label={Phrase.ManualRecordHotKeyLabel}
            description={Phrase.ManualRecordHotKeyDescription}
          />
          <HotKeyInput
            appState={appState}
            config={config}
            setConfig={setConfig}
            keyField="startFromReplayBufferHotKey"
            modifiersField="startFromReplayBufferHotKeyModifiers"
            label={Phrase.StartFromReplayBufferHotKeyLabel}
            description={Phrase.StartFromReplayBufferHotKeyDescription}
          />
        </>
      )}
    </div>
  );
};

export default ManualSettings;
