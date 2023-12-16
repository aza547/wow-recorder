import { Box, Button } from '@mui/material';
import { VideoCategory } from 'types/VideoCategory';
import { useEffect, useRef } from 'react';
import { ConfigurationSchema } from 'main/configSchema';
import { DeathMarkers } from 'main/types';
import { setConfigValues } from './useSettings';
import {
  convertNumToDeathMarkers,
  convertDeathMarkersToNum,
} from './rendererutils';

const buttonSx = {
  mx: 0.5,
  height: '40px',
  color: 'white',
  borderColor: 'white',
  ':hover': {
    color: '#bb4420',
    borderColor: '#bb4420',
  },
};

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

  const toggleDeaths = () => {
    const options = Object.values(DeathMarkers);
    const current = options.indexOf(deathMarkers);
    const next = current < options.length - 1 ? current + 1 : 0;

    setConfig((prevState) => {
      return {
        ...prevState,
        deathMarkers: convertDeathMarkersToNum(options[next]),
      };
    });
  };

  const toggleEncounters = () => {
    setConfig((prevState) => {
      return {
        ...prevState,
        encounterMarkers: !config.encounterMarkers,
      };
    });
  };

  const toggleRound = () => {
    setConfig((prevState) => {
      return {
        ...prevState,
        roundMarkers: !config.roundMarkers,
      };
    });
  };

  const renderDeathSelection = () => {
    let color;

    if (deathMarkers === DeathMarkers.ALL) {
      color = 'rgba(255, 255, 255, 1)';
    } else if (deathMarkers === DeathMarkers.OWN) {
      color = 'rgba(255, 255, 255, 0.75)';
    } else {
      color = 'rgba(255, 255, 255, 0.5)';
    }

    return (
      <Button
        variant="outlined"
        onClick={toggleDeaths}
        sx={{ ...buttonSx, color, borderColor: 'black' }}
      >
        Deaths: {deathMarkers}
      </Button>
    );
  };

  const renderEncounterSelection = () => {
    const text = config.encounterMarkers ? 'ON' : 'OFF';

    let color;

    if (config.encounterMarkers) {
      color = 'rgba(255, 255, 255, 1)';
    } else {
      color = 'rgba(255, 255, 255, 0.5)';
    }

    return (
      <Button
        variant="outlined"
        onClick={toggleEncounters}
        sx={{ ...buttonSx, color, borderColor: 'black' }}
      >
        Encounters: {text}
      </Button>
    );
  };

  const renderRoundSelection = () => {
    const text = config.roundMarkers ? 'ON' : 'OFF';

    let color;

    if (config.roundMarkers) {
      color = 'rgba(255, 255, 255, 1)';
    } else {
      color = 'rgba(255, 255, 255, 0.5)';
    }

    return (
      <Button
        variant="outlined"
        onClick={toggleRound}
        sx={{ ...buttonSx, color, borderColor: color }}
      >
        Round: {text}
      </Button>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {renderDeathSelection()}
      {category === VideoCategory.MythicPlus && renderEncounterSelection()}
      {category === VideoCategory.SoloShuffle && renderRoundSelection()}
    </Box>
  );
};

export default VideoMarkerToggles;
