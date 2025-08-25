import React, { useState } from 'react';
import { AppState, OurDisplayType } from 'main/types';
import { configSchema } from 'config/configSchema';
import { Info } from 'lucide-react';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { useSettings, setConfigValues } from './useSettings';
import Label from './components/Label/Label';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import Switch from './components/Switch/Switch';
import { Tooltip } from './components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
}

const VideoSourceControls = (props: IProps) => {
  const { appState } = props;
  const [config, setConfig] = useSettings();
  const [displays, setDisplays] = useState<OurDisplayType[]>([]);
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    const getDisplays = async () => {
      const allDisplays = await ipc.invoke('getAllDisplays', []);
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
      forceSdr: config.forceSdr,
    });

    ipc.sendMessage('settingsChange', []);
  }, [
    config.monitorIndex,
    config.obsCaptureMode,
    config.captureCursor,
    config.forceSdr,
  ]);

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
              configSchema.obsCaptureMode.description,
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
          <ToggleGroupItem value="monitor_capture">
            {getLocalePhrase(appState.language, Phrase.MonitorCaptureValue)}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  const getMonitorToggle = () => {
    if (config.obsCaptureMode !== 'monitor_capture') {
      return <></>;
    }

    return (
      <div>
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.MonitorLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.monitorIndex.description,
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
            <ToggleGroupItem
              value={display.index.toString()}
              key={display.index}
            >
              {display.index + 1}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    );
  };

  const getCursorToggle = () => {
    return (
      <div className="flex flex-col w-[120px]">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.CaptureCursorLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.captureCursor.description,
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

  const setForceSdr = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        forceSdr: checked,
      };
    });
  };

  const getForceSdrToggle = () => {
    return (
      <div className="flex flex-col w-[120px]">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.ForceSdrLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.forceSdr.description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch checked={config.forceSdr} onCheckedChange={setForceSdr} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center w-full gap-x-8">
      {getCaptureModeToggle()}
      {getMonitorToggle()}
      {getCursorToggle()}
      {getForceSdrToggle()}
    </div>
  );
};

export default VideoSourceControls;
