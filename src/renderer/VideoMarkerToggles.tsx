import { VideoCategory } from 'types/VideoCategory';
import { useEffect, useRef } from 'react';
import { ConfigurationSchema } from 'main/configSchema';
import { DeathMarkers } from 'main/types';
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
}

const VideoMarkerToggles = (props: IProps) => {
  const initialRender = useRef(true);
  const { category, config, setConfig } = props;
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
        <Label>Show deaths</Label>
        <ToggleGroup
          type="single"
          value={deathMarkers}
          size="sm"
          onValueChange={setDeaths}
          variant="outline"
        >
          <ToggleGroupItem value={DeathMarkers.ALL}>
            {DeathMarkers.ALL}
          </ToggleGroupItem>
          <ToggleGroupItem value={DeathMarkers.OWN}>
            {DeathMarkers.OWN}
          </ToggleGroupItem>
          <ToggleGroupItem value={DeathMarkers.NONE}>
            {DeathMarkers.NONE}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  const renderEncounterSelection = () => {
    return (
      <div>
        <Label>Show Encounters</Label>
        <ToggleGroup
          type="single"
          value={config.encounterMarkers.toString()}
          size="sm"
          variant="outline"
          onValueChange={setEncounterMarkers}
        >
          <ToggleGroupItem value="true">On</ToggleGroupItem>
          <ToggleGroupItem value="false">Off</ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  const renderRoundSelection = () => {
    return (
      <div>
        <Label>Show Rounds</Label>
        <ToggleGroup
          type="single"
          value={config.roundMarkers.toString()}
          size="sm"
          variant="outline"
          onValueChange={setRoundMarkers}
        >
          <ToggleGroupItem value="true">On</ToggleGroupItem>
          <ToggleGroupItem value="false">Off</ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-x-5">
      {renderDeathSelection()}
      {category === VideoCategory.MythicPlus && renderEncounterSelection()}
      {category === VideoCategory.SoloShuffle && renderRoundSelection()}
    </div>
  );
};

export default VideoMarkerToggles;
