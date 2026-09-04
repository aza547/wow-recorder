import { ConfigurationSchema } from 'config/configSchema';
import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';
import { Info } from 'lucide-react';
import { setConfigValues } from './useSettings';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Input } from './components/Input/Input';
import {
  getForceStopHotKeyFromConfig,
  getKeyModifiersString,
  getKeyPressEventString,
  getNextKeyOrMouseEvent,
} from './rendererutils';
import { PTTEventType, PTTKeyPressEvent } from 'types/KeyTypesUIOHook';

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

const HotKeySettings = (props: IProps) => {
  const { appState, config, setConfig } = props;
  const initialRender = useRef(true);
  const forceStopHotKeyInputRef = useRef<HTMLInputElement>(null);

  const [forceStopHotKeyFieldFocused, setForceStopHotKeyFieldFocused] =
    useState(false);

  const [forceStopHotKey, setForceStopHotKey] = useState<PTTKeyPressEvent>(
    getForceStopHotKeyFromConfig(config),
  );

  useEffect(() => {
    const setForceStopKeyConfig = (event: PTTKeyPressEvent) => {
      setConfig((prevState) => {
        return {
          ...prevState,
          forceStopHotKey: event.keyCode,
          forceStopHotKeyModifiers: getKeyModifiersString(event),
        };
      });
    };

    const listenNextKeyPress = async () => {
      if (forceStopHotKeyFieldFocused) {
        let keyPressEvent = await getNextKeyOrMouseEvent();

        while (
          keyPressEvent.type === PTTEventType.EVENT_MOUSE_PRESSED ||
          keyPressEvent.type === PTTEventType.EVENT_MOUSE_RELEASED
        ) {
          // Don't accept mouse events
          keyPressEvent = await getNextKeyOrMouseEvent();
        }

        setForceStopHotKeyFieldFocused(false);
        setForceStopHotKey(keyPressEvent);
        setForceStopKeyConfig(keyPressEvent);
        forceStopHotKeyInputRef.current?.blur();
      }
    };

    listenNextKeyPress();
  }, [forceStopHotKeyFieldFocused, setConfig]);

  useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      forceStopHotKey: config.forceStopHotKey,
      forceStopHotKeyModifiers: config.forceStopHotKeyModifiers,
    });
  }, [config.forceStopHotKey, config.forceStopHotKeyModifiers]);

  const getHotkeyString = () => {
    if (forceStopHotKeyFieldFocused) {
      return getLocalePhrase(appState.language, Phrase.PressAnyKeyCombination);
    }

    if (forceStopHotKey.keyCode > 0) {
      return `${getKeyPressEventString(forceStopHotKey, appState)} (${getLocalePhrase(
        appState.language,
        Phrase.ClickToRebind,
      )})`;
    }

    return getLocalePhrase(appState.language, Phrase.ClickToBind);
  };

  const getForceStopHotKeySelect = () => {
    return (
      <div className="flex flex-col">
        <Label htmlFor="forceStopHotKeyInput" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.ForceStopHotKeyLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              Phrase.ForceStopHotKeyDescription,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          ref={forceStopHotKeyInputRef}
          name="forceStopHotKeyInput"
          value={getHotkeyString()}
          onFocus={() => setForceStopHotKeyFieldFocused(true)}
          onBlur={() => setForceStopHotKeyFieldFocused(false)}
          readOnly
        />
      </div>
    );
  };

  return (
    <div className="flex flex-row flex-wrap gap-x-4">
      {getForceStopHotKeySelect()}
    </div>
  );
};

export default HotKeySettings;
