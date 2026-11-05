import { ConfigurationSchema } from 'config/configSchema';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { AppState } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';
import { Info } from 'lucide-react';
import { PTTEventType } from 'types/KeyTypesUIOHook';
import { setConfigValues } from './useSettings';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Input } from './components/Input/Input';
import {
  getKeyModifiersString,
  getKeyPressEventString,
  getHotKeyFromConfig,
  getNextKeyOrMouseEvent,
} from './rendererutils';

type HotKeyField =
  | 'manualRecordHotKey'
  | 'saveReplayBufferHotKey'
  | 'startFromReplayBufferHotKey';

type HotKeyModifiersField =
  | 'manualRecordHotKeyModifiers'
  | 'saveReplayBufferHotKeyModifiers'
  | 'startFromReplayBufferHotKeyModifiers';

interface HotKeyInputProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
  keyField: HotKeyField;
  modifiersField: HotKeyModifiersField;
  label: Phrase;
  description: Phrase;
}

/**
 * An input that, when focused, binds the next key press as a hotkey and
 * stores it in config.
 */
const HotKeyInput = (props: HotKeyInputProps) => {
  const {
    appState,
    config,
    setConfig,
    keyField,
    modifiersField,
    label,
    description,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const hotKey = getHotKeyFromConfig(config[keyField], config[modifiersField]);

  useEffect(() => {
    const listenNextKeyPress = async () => {
      if (focused) {
        let keyPressEvent = await getNextKeyOrMouseEvent();

        while (
          keyPressEvent.type === PTTEventType.EVENT_MOUSE_PRESSED ||
          keyPressEvent.type === PTTEventType.EVENT_MOUSE_RELEASED
        ) {
          // Don't accept mouse events
          keyPressEvent = await getNextKeyOrMouseEvent();
        }

        setFocused(false);

        const modifiers = getKeyModifiersString(keyPressEvent);

        setConfig((prevState) => {
          return {
            ...prevState,
            [keyField]: keyPressEvent.keyCode,
            [modifiersField]: modifiers,
          };
        });

        setConfigValues({
          [keyField]: keyPressEvent.keyCode,
          [modifiersField]: modifiers,
        });

        inputRef.current?.blur();
      }
    };

    listenNextKeyPress();
  }, [focused, setConfig, keyField, modifiersField]);

  const getHotkeyString = () => {
    if (focused) {
      return getLocalePhrase(appState.language, Phrase.PressAnyKeyCombination);
    }

    if (hotKey.keyCode > 0) {
      return `${getKeyPressEventString(hotKey, appState)} (${getLocalePhrase(
        appState.language,
        Phrase.ClickToRebind,
      )})`;
    }

    return getLocalePhrase(appState.language, Phrase.ClickToBind);
  };

  return (
    <div className="flex flex-col">
      <Label htmlFor={keyField} className="flex items-center">
        {getLocalePhrase(appState.language, label)}
        <Tooltip
          content={getLocalePhrase(appState.language, description)}
          side="right"
        >
          <Info size={20} className="inline-flex ml-2" />
        </Tooltip>
      </Label>
      <Input
        ref={inputRef}
        name={keyField}
        value={getHotkeyString()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        readOnly
      />
    </div>
  );
};

export default HotKeyInput;
