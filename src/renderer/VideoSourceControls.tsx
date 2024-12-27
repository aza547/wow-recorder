import { AppState, OurDisplayType } from 'main/types';
import { Phrase, getLocalePhrase } from 'localisation/translations';
import React, { useState } from 'react';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import { setConfigValues, useSettings } from './useSettings';

import { Info } from 'lucide-react';
import Label from './components/Label/Label';
import Switch from './components/Switch/Switch';
import { Tooltip } from './components/Tooltip/Tooltip';
import { configSchema } from 'config/configSchema';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
}

const VideoSourceControls = (props: IProps) => {
  const { appState } = props;
  const [config, setConfig] = useSettings();
  const [displays, setDisplays] = useState<OurDisplayType[]>([]);
  const initialRender = React.useRef(true);
  console.log('VideoSourceControls: displays', displays);

  React.useEffect(() => {
    const getDisplays = async () => {
      const allDisplays = await ipc.invoke('getAllDisplays', []);
      console.log('VideoSourceControls: allDisplays', allDisplays);
      setDisplays(allDisplays);
    };

    getDisplays();

    // The reset of this effect handles config changes, so if it's the
    // initial render then just return here.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      obsCaptureMode: config.obsCaptureMode,
      monitorIndex: config.monitorIndex,
      captureCursor: config.captureCursor,
    });

    ipc.sendMessage('settingsChange', []);
  }, [config.monitorIndex, config.obsCaptureMode, config.captureCursor]);

  const setOBSCaptureMode = (mode: string) => {
    if (mode === null) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        obsCaptureMode: mode,
      };
    });
  };

  const setMonitor = (display: string) => {
    if (display === null) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        monitorIndex: parseInt(display, 10),
      };
    });
  };

  const setCaptureCursor = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        captureCursor: checked,
      };
    });
  };

  const getCaptureModeToggle = () => {
    return (
      <div>
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.CaptureModeLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.obsCaptureMode.description
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <ToggleGroup
          value={config.obsCaptureMode}
          onValueChange={setOBSCaptureMode}
          size="sm"
          type="single"
          variant="outline"
        >
          <ToggleGroupItem value="window_capture">
            {getLocalePhrase(appState.language, Phrase.WindowCaptureValue)}
          </ToggleGroupItem>
          <ToggleGroupItem value="game_capture">
            {getLocalePhrase(appState.language, Phrase.GameCaptureValue)}
          </ToggleGroupItem>
          {/* <ToggleGroupItem value="monitor_capture"> */}
          <ToggleGroupItem value="display_capture">
            {getLocalePhrase(appState.language, Phrase.MonitorCaptureValue)}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  const getMonitorToggle = () => {
    // if (config.obsCaptureMode !== 'monitor_capture') {
    if (config.obsCaptureMode !== 'display_capture') {
      return <></>;
    }

    return (
      <div>
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.MonitorLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.monitorIndex.description
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <ToggleGroup
          value={config.monitorIndex.toString()}
          onValueChange={setMonitor}
          type="single"
          variant="outline"
          size="sm"
        >
          {displays.map((display: OurDisplayType) => (
            <ToggleGroupItem value={display.index.toString()}>
              {display.index + 1}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    );
  };

  const getCursorToggle = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.CaptureCursorLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.captureCursor.description
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={config.captureCursor}
            onCheckedChange={setCaptureCursor}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center w-full gap-x-8">
      {getCaptureModeToggle()}
      {getMonitorToggle()}
      {getCursorToggle()}
    </div>
  );
};

export default VideoSourceControls;
