import React from 'react';
import { configSchema } from 'main/configSchema';
import { Info, Lock } from 'lucide-react';
import { AppState } from 'main/types';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { useSettings, setConfigValues, getConfigValue } from './useSettings';
import { fileSelect } from './rendererutils';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import Switch from './components/Switch/Switch';
import { Input } from './components/Input/Input';
import Slider from './components/Slider/Slider';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
}

const ChatOverlayControls = (props: IProps) => {
  const { appState } = props;
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);
  const resolution = getConfigValue<string>('obsOutputResolution');
  const [xRes, yRes] = resolution.split('x').map((s) => parseInt(s, 10));

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      chatOverlayEnabled: config.chatOverlayEnabled,
      chatOverlayOwnImage: config.chatOverlayOwnImage,
      chatOverlayOwnImagePath: config.chatOverlayOwnImagePath,
      chatOverlayScale: config.chatOverlayScale,
      chatOverlayHeight: config.chatOverlayHeight,
      chatOverlayWidth: config.chatOverlayWidth,
      chatOverlayXPosition: config.chatOverlayXPosition,
      chatOverlayYPosition: config.chatOverlayYPosition,
    });

    ipc.sendMessage('settingsChange', []);
  }, [
    config.chatOverlayEnabled,
    config.chatOverlayOwnImage,
    config.chatOverlayOwnImagePath,
    config.chatOverlayScale,
    config.chatOverlayHeight,
    config.chatOverlayWidth,
    config.chatOverlayXPosition,
    config.chatOverlayYPosition,
  ]);

  const setOverlayEnabled = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayEnabled: checked,
      };
    });
  };

  const setOwnImage = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayOwnImage: checked,
      };
    });
  };

  const setWidth = (width: number[]) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayWidth: width[0],
      };
    });
  };

  const setHeight = (height: number[]) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayHeight: height[0],
      };
    });
  };

  const setXPosition = (xPos: number[]) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayXPosition: xPos[0],
      };
    });
  };

  const setYPosition = (yPos: number[]) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayYPosition: yPos[0],
      };
    });
  };

  const getChatOverlayEnabledSwitch = () => {
    return (
      <div className="flex flex-col">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.ChatOverlayLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.chatOverlayEnabled.description
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={config.chatOverlayEnabled}
            onCheckedChange={setOverlayEnabled}
          />
        </div>
      </div>
    );
  };

  const getChatOverlayOwnImageSwitch = () => {
    return (
      <div className="flex flex-col">
        <Label className="flex items-center gap-x-2">
          {getLocalePhrase(appState.language, Phrase.OwnImageLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.chatOverlayOwnImage.description
            )}
            side="right"
          >
            {config.cloudStorage ? (
              <Info size={20} className="inline-flex" />
            ) : (
              <Lock size={20} className="inline-flex" />
            )}
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={config.cloudStorage && config.chatOverlayOwnImage}
            onCheckedChange={setOwnImage}
            disabled={!config.cloudStorage || !config.chatOverlayEnabled}
          />
        </div>
      </div>
    );
  };

  const getChatOverlaySizeSliders = () => {
    if (config.chatOverlayOwnImage) return null;
    const disabled = !config.chatOverlayEnabled;

    return (
      <div className="flex flex-col gap-y-4">
        <div className="flex gap-x-3 items-center">
          <Label className="flex items-center h-[20px] w-[40px] mb-0">
            {getLocalePhrase(appState.language, Phrase.WidthLabel)}
          </Label>
          <div className="flex w-48 h-[20px] items-center">
            <Slider
              defaultValue={[config.chatOverlayWidth]}
              value={[config.chatOverlayWidth]}
              max={2000}
              step={1}
              onValueChange={setWidth}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="flex gap-x-3 items-center">
          <Label className="flex items-center h-[20px] w-[40px] mb-0">
            {getLocalePhrase(appState.language, Phrase.HeightLabel)}
          </Label>
          <div className="flex w-48 h-[20px] items-center">
            <Slider
              defaultValue={[config.chatOverlayHeight]}
              value={[config.chatOverlayHeight]}
              max={2000}
              step={1}
              onValueChange={setHeight}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    );
  };

  const getChatOverlayPositionSliders = () => {
    return (
      <div className="flex flex-col gap-y-4">
        <div className="flex gap-x-3 items-center">
          <Label className="flex items-center h-[20px] w-[60px] mb-0">
            {getLocalePhrase(appState.language, Phrase.HorizontalLabel)}
          </Label>
          <div className="flex w-48 h-[20px] items-center">
            <Slider
              defaultValue={[config.chatOverlayXPosition]}
              value={[config.chatOverlayXPosition]}
              disabled={!config.chatOverlayEnabled}
              max={xRes}
              step={1}
              onValueChange={setXPosition}
            />
          </div>
        </div>
        <div className="flex gap-x-3 items-center">
          <Label className="flex items-center h-[20px] w-[60px] mb-0">
            {getLocalePhrase(appState.language, Phrase.VerticalLabel)}
          </Label>
          <div className="flex w-48 h-[20px] items-center">
            <Slider
              defaultValue={[config.chatOverlayYPosition]}
              value={[config.chatOverlayYPosition]}
              max={yRes}
              step={1}
              onValueChange={setYPosition}
              disabled={!config.chatOverlayEnabled}
            />
          </div>
        </div>
      </div>
    );
  };

  const setScale = (scale: number[]) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayScale: scale[0],
      };
    });
  };

  const getScaleSlider = () => {
    return (
      <div className="flex gap-x-3 items-center">
        <Label className="flex items-center h-[20px] w-[40px] mb-0">
          Scale
        </Label>
        <div className="flex w-48 h-[20px] items-center">
          <Slider
            defaultValue={[config.chatOverlayScale]}
            value={[config.chatOverlayScale]}
            max={5}
            step={0.05}
            onValueChange={setScale}
            disabled={!config.chatOverlayEnabled}
          />
        </div>
      </div>
    );
  };

  const setOverlayPath = async () => {
    const newPath = await fileSelect();

    if (newPath === '') {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayOwnImagePath: newPath,
      };
    });
  };

  const getOwnImagePathField = () => {
    return (
      <div className="flex flex-col w-1/3 min-w-60 max-w-80">
        <Label htmlFor="bufferStoragePath" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.ImagePathLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.chatOverlayOwnImagePath.description
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="overlayImagePath"
          value={config.chatOverlayOwnImagePath}
          onClick={setOverlayPath}
          readOnly
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center content-center w-full flex-wrap gap-8">
      <div className="flex items-center content-center w-full gap-8">
        {getChatOverlayEnabledSwitch()}
        {getChatOverlayOwnImageSwitch()}
        {config.cloudStorage &&
          config.chatOverlayOwnImage &&
          getOwnImagePathField()}
      </div>
      {config.chatOverlayEnabled && (
        <div className="flex items-center content-center w-full gap-8">
          {getChatOverlaySizeSliders()}
          {getChatOverlayPositionSliders()}
          {getScaleSlider()}
        </div>
      )}
    </div>
  );
};

export default ChatOverlayControls;
