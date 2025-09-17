import { VideoCategory } from 'types/VideoCategory';
import { useEffect, useRef } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import { AppState, DeathMarkers } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';
import { setConfigValues } from './useSettings';
import {
  convertNumToDeathMarkers,
  convertDeathMarkersToNum,
} from './rendererutils';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import Label from './components/Label/Label';

interface IProps {
  config: ConfigurationSchema;
  setConfig: React.Dispatch<React.SetStateAction<ConfigurationSchema>>;
  category: VideoCategory;
  appState: AppState;
}

const VideoMarkerToggles = (props: IProps) => {
  const initialRender = useRef(true);
  const { category, config, setConfig, appState } = props;
  const deathMarkers = convertNumToDeathMarkers(config.deathMarkers);

  useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      deathMarkers: config.deathMarkers,
      encounterMarkers: config.encounterMarkers,
      roundMarkers: config.roundMarkers,
    });
  }, [config.deathMarkers, config.encounterMarkers, config.roundMarkers]);

  const setDeaths = (value: DeathMarkers) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        deathMarkers: convertDeathMarkersToNum(value),
      };
    });
  };

  const setEncounterMarkers = (value: string) => {
    const isTrue = value === 'true';
    setConfig((prevState) => {
      return {
        ...prevState,
        encounterMarkers: isTrue,
      };
    });
  };

  const setRoundMarkers = (value: string) => {
    const isTrue = value === 'true';
    setConfig((prevState) => {
      return {
        ...prevState,
        roundMarkers: isTrue,
      };
    });
  };

  const renderDeathSelection = () => {
    return (
      <div>
        <Label>
          {getLocalePhrase(appState.language, Phrase.ShowDeathsLabel)}
        </Label>
        <ToggleGroup
          type="single"
          value={deathMarkers}
          size="sm"
          onValueChange={setDeaths}
          variant="outline"
          className="border border-background"
        >
          <ToggleGroupItem value={DeathMarkers.ALL}>
            {getLocalePhrase(appState.language, Phrase.All)}
          </ToggleGroupItem>
          <ToggleGroupItem value={DeathMarkers.OWN}>
            {getLocalePhrase(appState.language, Phrase.Own)}
          </ToggleGroupItem>
          <ToggleGroupItem value={DeathMarkers.NONE}>
            {getLocalePhrase(appState.language, Phrase.None)}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  const renderEncounterSelection = () => {
    return (
      <div>
        <Label>
          {getLocalePhrase(appState.language, Phrase.ShowEncountersLabel)}
        </Label>
        <ToggleGroup
          type="single"
          value={config.encounterMarkers.toString()}
          size="sm"
          variant="outline"
          onValueChange={setEncounterMarkers}
          className="border border-background"
        >
          <ToggleGroupItem value="true">
            {getLocalePhrase(appState.language, Phrase.On)}
          </ToggleGroupItem>
          <ToggleGroupItem value="false">
            {getLocalePhrase(appState.language, Phrase.Off)}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  const renderRoundSelection = () => {
    return (
      <div>
        <Label>
          {getLocalePhrase(appState.language, Phrase.ShowRoundsLabel)}
        </Label>
        <ToggleGroup
          type="single"
          value={config.roundMarkers.toString()}
          size="sm"
          variant="outline"
          onValueChange={setRoundMarkers}
          className="border border-background"
        >
          <ToggleGroupItem value="true">
            {getLocalePhrase(appState.language, Phrase.On)}
          </ToggleGroupItem>
          <ToggleGroupItem value="false">
            {getLocalePhrase(appState.language, Phrase.Off)}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-x-2">
      {renderDeathSelection()}
      {category === VideoCategory.MythicPlus && renderEncounterSelection()}
      {category === VideoCategory.SoloShuffle && renderRoundSelection()}
    </div>
  );
};

export default VideoMarkerToggles;
