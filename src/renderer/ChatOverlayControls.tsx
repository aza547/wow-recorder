import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { configSchema, ConfigurationSchema } from 'config/configSchema';
import { Info, Lock } from 'lucide-react';
import { AppState, SceneItem } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { setConfigValues } from './useSettings';
import { imageSelect } from './rendererutils';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import Switch from './components/Switch/Switch';
import { Input } from './components/Input/Input';
import { Phrase } from 'localisation/phrases';
import Slider from './components/Slider/Slider';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

const ChatOverlayControls = (props: IProps) => {
  const { appState, config, setConfig } = props;
  const { cloudStatus } = appState;
  const initialRender = useRef(true);

  const [cropMaxX, setCropMaxX] = useState(0);
  const [cropMaxY, setCropMaxY] = useState(0);

  const initCropSliders = async () => {
    if (!config.chatOverlayEnabled) return;
    const pos = await ipc.getSourcePosition(SceneItem.OVERLAY);
    // Don't let them scale to less than 80% of the dimension.
    // That seems reasonable to avoid weird issues.
    setCropMaxX(0.8 * Math.round(pos.width / 2));
    setCropMaxY(0.8 * Math.round(pos.height / 2));
  };

  useEffect(() => {
    if (initialRender.current) return;

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

  useEffect(() => {
    // If the user changes an overlay source, it will fire the source
    //  callback, which we react to to ensure the sliders are sensible.
    ipc.on('initCropSliders', initCropSliders);

    return () => {
      ipc.removeAllListeners('initCropSliders');
    };
  }, [initCropSliders]);

  useEffect(() => {
    initCropSliders();
    initialRender.current = false;
  }, []);

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

  const setCropX = async (array: number[]) => {
    const value = array[0];
    setConfig((prev) => ({ ...prev, chatOverlayCropX: value }));
    const p = await ipc.getSourcePosition(SceneItem.OVERLAY);
    p.cropLeft = value;
    p.cropRight = value;
    await ipc.setSourcePosition(SceneItem.OVERLAY, p);
  };

  const setCropY = async (array: number[]) => {
    const value = array[0];
    setConfig((prev) => ({ ...prev, chatOverlayCropY: value }));
    const p = await ipc.getSourcePosition(SceneItem.OVERLAY);
    p.cropTop = value;
    p.cropBottom = value;
    await ipc.setSourcePosition(SceneItem.OVERLAY, p);
  };

  const getChatOverlayCropSliders = () => {
    const { chatOverlayCropX, chatOverlayCropY } = config;
    console.log({ chatOverlayCropX, chatOverlayCropY });
    return (
      <div className="flex flex-col gap-y-4 w-full mt-2">
        <div className="flex gap-x-3 items-center">
          <Label className="flex items-center w-[75px] mb-0">
            {getLocalePhrase(appState.language, Phrase.WidthLabel)}
            <Tooltip
              content={getLocalePhrase(
                appState.language,
                configSchema.chatOverlayCropX.description,
              )}
              side="right"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex w-[150px] items-center">
            <Slider
              value={[config.chatOverlayCropX]}
              max={cropMaxX}
              step={1}
              onValueChange={setCropX}
            />
          </div>
        </div>
        <div className="flex gap-x-3 items-center">
          <Label className="flex items-center w-[75px] mb-0">
            {getLocalePhrase(appState.language, Phrase.HeightLabel)}
            <Tooltip
              content={getLocalePhrase(
                appState.language,
                configSchema.chatOverlayCropY.description,
              )}
              side="right"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex w-[150px] items-center">
            <Slider
              value={[config.chatOverlayCropY]}
              max={cropMaxY}
              step={1}
              onValueChange={setCropY}
            />
          </div>
        </div>
      </div>
    );
  };

  const showPathWarning =
    config.chatOverlayOwnImage &&
    !config.chatOverlayOwnImagePath.endsWith('.png') &&
    !config.chatOverlayOwnImagePath.endsWith('.gif') &&
    !(appState.isLinux && 
      (config.chatOverlayOwnImagePath.endsWith('.jpg') || 
      config.chatOverlayOwnImagePath.endsWith('.jpeg')));


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
          {getLocalePhrase(appState.language, (appState.isLinux 
            ? Phrase.ErrorCustomImageFileTypeLinux 
            : Phrase.ErrorCustomImageFileType))}
        </p>
      )}
      {config.chatOverlayEnabled && getChatOverlayCropSliders()}
    </div>
  );
};

export default ChatOverlayControls;
