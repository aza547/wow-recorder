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
import {
  getKeyModifiersString,
  getKeyPressEventString,
  getManualRecordHotKeyFromConfig,
  getNextKeyOrMouseEvent,
} from './rendererutils';
import { PTTEventType, PTTKeyPressEvent } from 'types/KeyTypesUIOHook';

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

const ManualSettings = (props: IProps) => {
  const { appState, config, setConfig } = props;
  const initialRender = useRef(true);
  const manualHotKeyInputRef = useRef<HTMLInputElement>(null);

  const [manualHotKeyFieldFocused, setManualHotKeyFieldFocused] =
    useState(false);

  const [manualHotKey, setManualHotKey] = useState<PTTKeyPressEvent>(
    getManualRecordHotKeyFromConfig(config),
  );

  useEffect(() => {
    const setManualKeyConfig = (event: PTTKeyPressEvent) => {
      setConfig((prevState) => {
        return {
          ...prevState,
          manualRecordHotKey: event.keyCode,
          manualRecordHotKeyModifiers: getKeyModifiersString(event),
        };
      });
    };

    const listenNextKeyPress = async () => {
      if (manualHotKeyFieldFocused) {
        let keyPressEvent = await getNextKeyOrMouseEvent();

        while (
          keyPressEvent.type === PTTEventType.EVENT_MOUSE_PRESSED ||
          keyPressEvent.type === PTTEventType.EVENT_MOUSE_RELEASED
        ) {
          // Don't accept mouse events
          keyPressEvent = await getNextKeyOrMouseEvent();
        }

        setManualHotKeyFieldFocused(false);
        setManualHotKey(keyPressEvent);
        setManualKeyConfig(keyPressEvent);
        manualHotKeyInputRef.current?.blur();
      }
    };

    listenNextKeyPress();
  }, [manualHotKeyFieldFocused, setConfig]);

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

  const getHotkeyString = () => {
    if (manualHotKeyFieldFocused) {
      return getLocalePhrase(appState.language, Phrase.PressAnyKeyCombination);
    }

    if (manualHotKey !== null) {
      return `${getKeyPressEventString(manualHotKey, appState)} (${getLocalePhrase(
        appState.language,
        Phrase.ClickToRebind,
      )})`;
    }

    return getLocalePhrase(appState.language, Phrase.ClickToBind);
  };

  const getManualHotKeySelect = () => {
    return (
      <div className="flex flex-col">
        <Label htmlFor="pttKey" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.ManualRecordHotKeyLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              Phrase.ManualRecordHotKeyDescription,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          ref={manualHotKeyInputRef}
          name="manualHotKeyInput"
          value={getHotkeyString()}
          onFocus={() => setManualHotKeyFieldFocused(true)}
          onBlur={() => setManualHotKeyFieldFocused(false)}
          readOnly
        />
      </div>
    );
  };

  return (
    <div className="flex flex-row flex-wrap gap-x-4">
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

      {config.manualRecord && getManualHotKeySelect()}
    </div>
  );
};

export default ManualSettings;
