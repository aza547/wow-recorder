import { FC, useEffect, useRef, useState } from 'react';
import { AppState, Encoder, RecStatus } from 'main/types';
import { obsResolutions } from 'main/constants';
import { configSchema } from 'config/configSchema';
import { ESupportedEncoders, QualityPresets } from 'main/obsEnums';
import { Info } from 'lucide-react';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { useSettings, setConfigValues } from './useSettings';
import {
  encoderFilter,
  isHighRes,
  mapEncoderToString,
  mapStringToEncoder,
} from './rendererutils';
import Label from './components/Label/Label';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import { Tooltip } from './components/Tooltip/Tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/Select/Select';
import TextBanner from './components/TextBanner/TextBanner';

const ipc = window.electron.ipcRenderer;

const outputResolutions = Object.keys(obsResolutions);
const fpsOptions = [10, 20, 30, 60];

interface IProps {
  recorderStatus: RecStatus;
  appState: AppState;
}

/**
 * The video base controls. The distinction here between the controls in
 * VideoSourceControls is that the base controls can't be changed live.
 *
 *   - If we're mid encounter, we can't allow settings changes as we can't
 *     stop/start the recording without ruining the clip.
 *   - If WoW is open, OBS is recording but it's uninteresting footage,
 *     changes are allowed but we will need to restart the recorder.
 *   - Otherwise, let the user do whatever they want.
 */
const VideoBaseControls: FC<IProps> = (props: IProps) => {
  const [config, setConfig] = useSettings();
  const { recorderStatus, appState } = props;
  const initialRender = useRef(true);
  const highRes = isHighRes(config.obsOutputResolution);
  const [encoders, setEncoders] = useState<Encoder[]>([]);

  useEffect(() => {
    const getAvailableEncoders = async () => {
      const allEncoders = await ipc.invoke('getEncoders', []);

      const availableEncoders = allEncoders
        .filter((s: string) => encoderFilter(s, highRes))
        .map(mapStringToEncoder)
        .sort((a: Encoder, b: Encoder) => a.type < b.type);

      setEncoders(availableEncoders);
    };

    getAvailableEncoders();

    // The reset of this effect handles config changes, so if it's the
    // initial render then just return here.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      obsOutputResolution: config.obsOutputResolution,
      obsFPS: config.obsFPS,
      obsQuality: config.obsQuality,
      obsRecEncoder: config.obsRecEncoder,
    });

    ipc.sendMessage('settingsChange', []);
  }, [
    config.obsOutputResolution,
    config.obsFPS,
    config.obsQuality,
    config.obsRecEncoder,
    highRes,
  ]);

  const isComponentDisabled = () => {
    const isRecording = recorderStatus === RecStatus.Recording;
    const isOverrunning = recorderStatus === RecStatus.Overrunning;
    return isRecording || isOverrunning;
  };

  const setCanvasResolution = (value: string) => {
    const selectedhighRes = isHighRes(value);

    if (selectedhighRes) {
      setConfig((prevState) => {
        return {
          ...prevState,
          obsOutputResolution: value,
          obsRecEncoder: ESupportedEncoders.OBS_X264,
        };
      });
    } else {
      setConfig((prevState) => {
        return {
          ...prevState,
          obsOutputResolution: value,
        };
      });
    }
  };

  const getCanvasResolutionSelect = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.CanvasResolutionLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.obsOutputResolution.description
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Select
          value={config.obsOutputResolution}
          onValueChange={setCanvasResolution}
          disabled={isComponentDisabled()}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a resolution" />
          </SelectTrigger>
          <SelectContent side="right" position="popper">
            {outputResolutions.map((resolution) => (
              <SelectItem key={resolution} value={resolution}>
                {resolution}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const setFPS = (fps: string) => {
    if (fps === null) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        obsFPS: parseInt(fps, 10),
      };
    });
  };

  const getFPSToggle = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div>
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.FPSLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.obsFPS.description
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <ToggleGroup
          value={config.obsFPS.toString()}
          onValueChange={setFPS}
          size="sm"
          type="single"
          variant="outline"
        >
          {fpsOptions.map((fpsOption) => (
            <ToggleGroupItem
              key={fpsOption.toString()}
              value={fpsOption.toString()}
            >
              {fpsOption}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    );
  };

  const setQuality = (value: string) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsQuality: value,
      };
    });
  };

  const getDisabledText = () => {
    if (!isComponentDisabled()) {
      return <></>;
    }

    return (
      <TextBanner>
        {getLocalePhrase(appState.language, Phrase.SettingsDisabledText)}
      </TextBanner>
    );
  };

  const getQualitySelect = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    const cloudFilter = (quality: QualityPresets) => {
      if (config.cloudUpload) return quality !== QualityPresets.ULTRA;
      return true;
    };

    const translateQuality = (p: QualityPresets) => {
      switch (p) {
        case QualityPresets.ULTRA:
          return getLocalePhrase(appState.language, Phrase.Ultra);
        case QualityPresets.HIGH:
          return getLocalePhrase(appState.language, Phrase.High);
        case QualityPresets.MODERATE:
          return getLocalePhrase(appState.language, Phrase.Moderate);
        case QualityPresets.LOW:
          return getLocalePhrase(appState.language, Phrase.Low);
        default:
          throw new Error('Unknown quality');
      }
    };

    const options = Object.values(QualityPresets).filter(cloudFilter);

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.QualityLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.obsQuality.description
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Select
          value={config.obsQuality}
          onValueChange={setQuality}
          disabled={isComponentDisabled()}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select quality" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {translateQuality(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const setEncoder = (value: string) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsRecEncoder: value,
      };
    });
  };

  const getEncoderSelect = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-60 max-w-80">
        <Label className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.VideoEncoderLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.obsRecEncoder.description
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Select
          value={config.obsRecEncoder}
          onValueChange={setEncoder}
          disabled={isComponentDisabled()}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select encoder" />
          </SelectTrigger>
          <SelectContent>
            {encoders.map((encoder) => (
              <SelectItem key={encoder.name} value={encoder.name}>
                {mapEncoderToString(encoder, appState.language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full">
      {getDisabledText()}
      <div className="flex items-center w-full gap-x-8">
        {getFPSToggle()}
        {getCanvasResolutionSelect()}
        {getQualitySelect()}
        {getEncoderSelect()}
      </div>
    </div>
  );
};

export default VideoBaseControls;
