import React from 'react';
import { configSchema } from 'config/configSchema';
import { Info, Lock } from 'lucide-react';
import { AppState } from 'main/types';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { useSettings, setConfigValues } from './useSettings';
import { fileSelect } from './rendererutils';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import Switch from './components/Switch/Switch';
import { Input } from './components/Input/Input';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
}

const ChatOverlayControls = (props: IProps) => {
  const { appState } = props;
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

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

  const getChatOverlayEnabledSwitch = () => {
    return (
      <div className="flex flex-col">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.ChatOverlayLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.chatOverlayEnabled.description,
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
              configSchema.chatOverlayOwnImage.description,
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
        <Label htmlFor="overlayImagePath" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.ImagePathLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.chatOverlayOwnImagePath.description,
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
    <div className="flex flex-col items-center content-center w-full flex-wrap gap-4">
      <div className="flex items-center content-center w-full gap-8">
        {getChatOverlayEnabledSwitch()}
        {getChatOverlayOwnImageSwitch()}
        {config.cloudStorage &&
          config.chatOverlayOwnImage &&
          getOwnImagePathField()}
      </div>
      <div className="text-sm font-semibold text-foreground text-left w-full">
        {getLocalePhrase(appState.language, Phrase.ChatOverlayTip) ||
          'Tip: Click and drag to move the chat overlay.'}
      </div>
    </div>
  );
};

export default ChatOverlayControls;
