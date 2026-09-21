import { ConfigurationSchema } from 'config/configSchema';
import React, { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { AppState } from 'main/types';
import { Phrase } from 'localisation/phrases';
import { PTTKeyPressEvent } from 'types/KeyTypesUIOHook';
import { setConfigValues } from './useSettings';
import HotKeyInput from './components/HotKeyInput/HotKeyInput';
import {
  getForceStopHotKeyFromConfig,
  getKeyModifiersString,
  getManualRecordHotKeyFromConfig,
} from './rendererutils';

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

const HotKeySettings = (props: IProps) => {
  const { appState, config, setConfig } = props;
  const initialRender = useRef(true);

  useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      manualRecordHotKey: config.manualRecordHotKey,
      manualRecordHotKeyModifiers: config.manualRecordHotKeyModifiers,
      forceStopHotKey: config.forceStopHotKey,
      forceStopHotKeyModifiers: config.forceStopHotKeyModifiers,
    });
  }, [
    config.manualRecordHotKey,
    config.manualRecordHotKeyModifiers,
    config.forceStopHotKey,
    config.forceStopHotKeyModifiers,
  ]);

  const setManualRecordHotKey = (event: PTTKeyPressEvent) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        manualRecordHotKey: event.keyCode,
        manualRecordHotKeyModifiers: getKeyModifiersString(event),
      };
    });
  };

  const setForceStopHotKey = (event: PTTKeyPressEvent) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        forceStopHotKey: event.keyCode,
        forceStopHotKeyModifiers: getKeyModifiersString(event),
      };
    });
  };

  return (
    <div className="flex flex-row flex-wrap gap-x-4">
      <HotKeyInput
        appState={appState}
        id="manualRecordHotKeyInput"
        label={Phrase.ManualRecordHotKeyLabel}
        description={Phrase.ManualRecordHotKeyDescription}
        hotKey={getManualRecordHotKeyFromConfig(config)}
        onRebind={setManualRecordHotKey}
      />
      <HotKeyInput
        appState={appState}
        id="forceStopHotKeyInput"
        label={Phrase.ForceStopHotKeyLabel}
        description={Phrase.ForceStopHotKeyDescription}
        hotKey={getForceStopHotKeyFromConfig(config)}
        onRebind={setForceStopHotKey}
      />
    </div>
  );
};

export default HotKeySettings;
