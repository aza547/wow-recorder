import React, { Dispatch, SetStateAction } from 'react';
import { configSchema, ConfigurationSchema } from 'config/configSchema';
import { Info, Lock } from 'lucide-react';
import { AppState } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { setConfigValues } from './useSettings';
import { imageSelect } from './rendererutils';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import Switch from './components/Switch/Switch';
import { Input } from './components/Input/Input';
import { Phrase } from 'localisation/phrases';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

const ChatOverlayControls = (props: IProps) => {
  const { appState, config, setConfig } = props;
  const { cloudStatus } = appState;
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
    });

    ipc.reconfigureOverlay();
  }, [
    config.chatOverlayEnabled,
    config.chatOverlayOwnImage,
    config.chatOverlayOwnImagePath,
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
            {cloudStatus.authorized ? (
              <Info size={20} className="inline-flex" />
            ) : (
              <Lock size={20} className="inline-flex" />
            )}
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={config.chatOverlayOwnImage}
            onCheckedChange={setOwnImage}
            disabled={
              !config.chatOverlayOwnImage &&
              (!config.chatOverlayEnabled || !cloudStatus.authorized)
            }
          />
        </div>
      </div>
    );
  };

  const setOverlayPath = async () => {
    const newPath = await imageSelect();

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
        <>
          <Input
            name="overlayImagePath"
            value={config.chatOverlayOwnImagePath}
            onClick={setOverlayPath}
            readOnly
          />
        </>
      </div>
    );
  };

  const showPathWarning =
    config.chatOverlayOwnImage &&
    !config.chatOverlayOwnImagePath.endsWith('.png') &&
    !config.chatOverlayOwnImagePath.endsWith('.gif');

  return (
    <div className="flex flex-col items-center content-center w-full flex-wrap gap-4">
      <div className="flex items-center content-center w-full gap-8">
        {getChatOverlayEnabledSwitch()}
        {config.chatOverlayEnabled && getChatOverlayOwnImageSwitch()}
        {config.chatOverlayEnabled &&
          config.chatOverlayOwnImage &&
          getOwnImagePathField()}
      </div>
      {showPathWarning && (
        <p className="flex w-full text-red-500 text-sm">
          {getLocalePhrase(appState.language, Phrase.ErrorCustomImageFileType)}
        </p>
      )}
    </div>
  );
};

export default ChatOverlayControls;
