import React, { useEffect, useState } from 'react';
import { AppState } from 'main/types';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { Switch } from './components/Switch/Switch';
import { Button } from './components/Button/Button';
import { Tooltip } from './components/Tooltip/Tooltip';
import Label from './components/Label/Label';
import { useSettings } from './useSettings';

interface IProps {
  appState: AppState;
}

const TimestampMarkerSettings: React.FC<IProps> = (props: IProps) => {
  const { appState } = props;
  const { language } = appState;
  const { getConfigValue, setConfigValue } = useSettings();

  const [enabled, setEnabled] = useState<boolean>(
    getConfigValue('timestampMarkerEnabled')
  );
  const [key, setKey] = useState<number>(getConfigValue('timestampMarkerKey'));
  const [mouseButton, setMouseButton] = useState<number>(
    getConfigValue('timestampMarkerMouseButton')
  );
  const [modifiers, setModifiers] = useState<string>(
    getConfigValue('timestampMarkerModifiers')
  );
  const [listening, setListening] = useState<boolean>(false);
  const [displayText, setDisplayText] = useState<string>('');

  useEffect(() => {
    updateDisplayText();
  }, [key, mouseButton, modifiers]);

  const updateDisplayText = () => {
    const parts = [];

    if (modifiers) {
      modifiers.split(',').forEach((mod) => {
        if (mod === 'shift') parts.push('Shift');
        if (mod === 'ctrl') parts.push('Ctrl');
        if (mod === 'alt') parts.push('Alt');
        if (mod === 'meta') parts.push('Meta');
      });
    }

    if (key !== -1) {
      parts.push(getKeyName(key));
    }

    if (mouseButton !== -1) {
      parts.push(`Mouse ${mouseButton}`);
    }

    setDisplayText(parts.join(' + '));
  };

  const getKeyName = (keyCode: number): string => {
    // This is a simplified version - you might want to expand this
    const keyMap: { [key: number]: string } = {
      8: 'Backspace',
      9: 'Tab',
      13: 'Enter',
      16: 'Shift',
      17: 'Ctrl',
      18: 'Alt',
      19: 'Pause',
      20: 'CapsLock',
      27: 'Escape',
      32: 'Space',
      33: 'PageUp',
      34: 'PageDown',
      35: 'End',
      36: 'Home',
      37: 'ArrowLeft',
      38: 'ArrowUp',
      39: 'ArrowRight',
      40: 'ArrowDown',
      45: 'Insert',
      46: 'Delete',
      // Add more as needed
    };

    // For letter keys (65-90 are A-Z)
    if (keyCode >= 65 && keyCode <= 90) {
      return String.fromCharCode(keyCode);
    }

    // For number keys (48-57 are 0-9)
    if (keyCode >= 48 && keyCode <= 57) {
      return String.fromCharCode(keyCode);
    }

    // For F1-F12 keys
    if (keyCode >= 112 && keyCode <= 123) {
      return `F${keyCode - 111}`;
    }

    return keyMap[keyCode] || `Key(${keyCode})`;
  };

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(checked);
    setConfigValue('timestampMarkerEnabled', checked);
  };

  const startListening = async () => {
    setListening(true);
    setDisplayText('Press a key or mouse button...');

    try {
      const event = await window.electron.ipcRenderer.invoke('getNextKeyPress');

      // Reset previous values
      setKey(-1);
      setMouseButton(-1);
      setModifiers('');

      // Set new values based on the event
      if (event.type === 'keydown') {
        setKey(event.keycode);
      } else if (event.type === 'mousedown') {
        setMouseButton(event.button);
      }

      // Set modifiers
      const newModifiers = [];
      if (event.shiftKey) newModifiers.push('shift');
      if (event.ctrlKey) newModifiers.push('ctrl');
      if (event.altKey) newModifiers.push('alt');
      if (event.metaKey) newModifiers.push('meta');

      setModifiers(newModifiers.join(','));

      // Save to config
      setConfigValue('timestampMarkerKey', event.type === 'keydown' ? event.keycode : -1);
      setConfigValue('timestampMarkerMouseButton', event.type === 'mousedown' ? event.button : -1);
      setConfigValue('timestampMarkerModifiers', newModifiers.join(','));

    } catch (error) {
      console.error('Error getting key press:', error);
    } finally {
      setListening(false);
    }
  };

  const clearHotkey = () => {
    setKey(-1);
    setMouseButton(-1);
    setModifiers('');
    setConfigValue('timestampMarkerKey', -1);
    setConfigValue('timestampMarkerMouseButton', -1);
    setConfigValue('timestampMarkerModifiers', '');
    setDisplayText('');
  };

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <Label>
          {getLocalePhrase(language, Phrase.TimestampMarkerEnabledDescription)}
        </Label>
        <Switch
          checked={enabled}
          onCheckedChange={handleEnabledChange}
        />
      </div>

      <div className="flex items-center gap-x-4">
        <Label>
          {getLocalePhrase(language, Phrase.TimestampMarkerHotkeyLabel)}
        </Label>
        <div className="flex items-center gap-x-2">
          <Button
            variant="outline"
            onClick={startListening}
            disabled={listening || !enabled}
          >
            {displayText || 'Click to set hotkey'}
          </Button>
          <Tooltip content="Clear hotkey">
            <Button
              variant="outline"
              onClick={clearHotkey}
              disabled={!enabled || (!key && !mouseButton)}
            >
              Clear
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="text-sm text-foreground-lighter mt-2">
        {getLocalePhrase(language, Phrase.TimestampMarkerTooltip)}
      </div>
    </div>
  );
};

export default TimestampMarkerSettings;

