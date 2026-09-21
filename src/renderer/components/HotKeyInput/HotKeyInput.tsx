import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';
import { Info } from 'lucide-react';
import { PTTEventType, PTTKeyPressEvent } from 'types/KeyTypesUIOHook';
import {
  getKeyPressEventString,
  getNextKeyOrMouseEvent,
} from '../../rendererutils';
import Label from '../Label/Label';
import { Tooltip } from '../Tooltip/Tooltip';
import { Input } from '../Input/Input';

interface IProps {
  appState: AppState;

  /**
   * Ties the label to the input, so must be unique on the page.
   */
  id: string;

  label: Phrase;
  description: Phrase;

  /**
   * The hotkey currently bound. An unbound hotkey has a key code of -1.
   */
  hotKey: PTTKeyPressEvent;

  /**
   * Called with the new binding once the user has pressed a key. It's up to
   * the caller whether to accept it; the displayed value comes from the
   * hotKey prop, so a rejected binding simply leaves the field unchanged.
   */
  onRebind: (event: PTTKeyPressEvent) => void;

  /**
   * Message to show under the field, e.g. to explain a rejected binding.
   * Hidden while listening so it doesn't sit there contradicting the prompt.
   */
  error?: string;
}

/**
 * An input for binding a hotkey. Clicking it listens for the next key press,
 * which becomes the new binding. Mouse presses are ignored as none of the
 * hotkeys this is used for support mouse buttons.
 */
const HotKeyInput = (props: IProps) => {
  const { appState, id, label, description, hotKey, onRebind, error } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);

  // Held in a ref so that a caller passing an inline callback doesn't restart
  // the listener below on every render.
  const onRebindRef = useRef(onRebind);

  useEffect(() => {
    onRebindRef.current = onRebind;
  }, [onRebind]);

  useEffect(() => {
    if (!listening) {
      return undefined;
    }

    // The user can click away, or navigate off the settings page entirely,
    // while we're waiting on a key press. Track that so we don't bind
    // whatever key they happen to press next, long after they've moved on.
    let cancelled = false;

    const listenNextKeyPress = async () => {
      for (;;) {
        const event = await getNextKeyOrMouseEvent();

        if (cancelled) {
          return;
        }

        if (
          event.type === PTTEventType.EVENT_MOUSE_PRESSED ||
          event.type === PTTEventType.EVENT_MOUSE_RELEASED
        ) {
          // Don't accept mouse events, keep waiting for a key.
          continue;
        }

        setListening(false);
        onRebindRef.current(event);
        inputRef.current?.blur();
        return;
      }
    };

    listenNextKeyPress();

    return () => {
      cancelled = true;
    };
  }, [listening]);

  const getHotKeyString = () => {
    if (listening) {
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
      <Label htmlFor={id} className="flex items-center">
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
        id={id}
        name={id}
        value={getHotKeyString()}
        onFocus={() => setListening(true)}
        onBlur={() => setListening(false)}
        readOnly
      />
      {error && !listening && (
        <span className="text-error text-xs mt-2">{error}</span>
      )}
    </div>
  );
};

export default HotKeyInput;
