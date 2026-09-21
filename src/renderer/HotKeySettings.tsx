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
import { PTTKeyPressEvent } from 'types/KeyTypesUIOHook';
import { setConfigValues } from './useSettings';
import HotKeyInput from './components/HotKeyInput/HotKeyInput';
import {
  getForceStopHotKeyFromConfig,
  getKeyModifiersString,
  getManualRecordHotKeyFromConfig,
  isSameHotKey,
} from './rendererutils';

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

/**
 * Which field, if any, the user last tried to give a binding that another
 * hotkey already has.
 */
type HotKeyConflict = 'manualRecord' | 'forceStop' | undefined;

const HotKeySettings = (props: IProps) => {
  const { appState, config, setConfig } = props;
  const initialRender = useRef(true);
  const [conflict, setConflict] = useState<HotKeyConflict>(undefined);

  const manualRecordHotKey = getManualRecordHotKeyFromConfig(config);
  const forceStopHotKey = getForceStopHotKeyFromConfig(config);

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

  /**
   * Two hotkeys sharing a combination would leave one of them unreachable, so
   * reject the binding and tell the user rather than letting them create it.
   */
  const setManualRecordHotKey = (event: PTTKeyPressEvent) => {
    if (isSameHotKey(event, forceStopHotKey)) {
      setConflict('manualRecord');
      return;
    }

    setConflict(undefined);

    setConfig((prevState) => {
      return {
        ...prevState,
        manualRecordHotKey: event.keyCode,
        manualRecordHotKeyModifiers: getKeyModifiersString(event),
      };
    });
  };

  const setForceStopHotKey = (event: PTTKeyPressEvent) => {
    if (isSameHotKey(event, manualRecordHotKey)) {
      setConflict('forceStop');
      return;
    }

    setConflict(undefined);

    setConfig((prevState) => {
      return {
        ...prevState,
        forceStopHotKey: event.keyCode,
        forceStopHotKeyModifiers: getKeyModifiersString(event),
      };
    });
  };

  const getConflictText = (field: HotKeyConflict) => {
    if (conflict !== field) {
      return undefined;
    }

    return getLocalePhrase(appState.language, Phrase.HotKeyConflictText);
  };

  return (
    <div className="flex flex-row flex-wrap gap-x-4">
      <HotKeyInput
        appState={appState}
        id="manualRecordHotKeyInput"
        label={Phrase.ManualRecordHotKeyLabel}
        description={Phrase.ManualRecordHotKeyDescription}
        hotKey={manualRecordHotKey}
        onRebind={setManualRecordHotKey}
        error={getConflictText('manualRecord')}
      />
      <HotKeyInput
        appState={appState}
        id="forceStopHotKeyInput"
        label={Phrase.ForceStopHotKeyLabel}
        description={Phrase.ForceStopHotKeyDescription}
        hotKey={forceStopHotKey}
        onRebind={setForceStopHotKey}
        error={getConflictText('forceStop')}
      />
    </div>
  );
};

export default HotKeySettings;
