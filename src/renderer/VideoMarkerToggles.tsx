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
  ':hover': {
    color: 'white',
    borderColor: '#bb4420',
    background: '#bb4420',
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
    let backgroundColor;

    if (deathMarkers === DeathMarkers.ALL) {
      color = 'rgba(255, 255, 255, 1)';
      backgroundColor = 'rgba(187, 68, 32, 0.75)';
    } else if (deathMarkers === DeathMarkers.OWN) {
      color = 'rgba(255, 255, 255, 0.75)';
      backgroundColor = 'rgba(187, 68, 32, 0.4)';
    } else {
      color = 'rgba(255, 255, 255, 0.5)';
      backgroundColor = 'rgba(0, 0, 0, 0)';
    }

    return (
      <Button
        variant="outlined"
        onClick={toggleDeaths}
        sx={{
          ...buttonSx,
          color,
          backgroundColor,
          border: ' 1px solid black',
        }}
      >
        Deaths: {deathMarkers}
      </Button>
    );
  };

  const renderEncounterSelection = () => {
    const text = config.encounterMarkers ? 'ON' : 'OFF';

    let color;
    let backgroundColor;

    if (config.encounterMarkers) {
      color = 'rgba(255, 255, 255, 1)';
      backgroundColor = 'rgba(163, 53, 238, 0.5)';
    } else {
      color = 'rgba(255, 255, 255, 0.5)';
      backgroundColor = 'rgba(0, 0, 0, 0)';
    }

    return (
      <Button
        variant="contained"
        onClick={toggleEncounters}
        sx={{
          ...buttonSx,
          color,
          border: '1px solid black',
          backgroundColor,
        }}
      >
        Encounters: {text}
      </Button>
    );
  };

  const renderRoundSelection = () => {
    const text = config.roundMarkers ? 'ON' : 'OFF';

    let color;
    let background;

    if (config.roundMarkers) {
      color = 'rgba(255, 255, 255, 1)';
      background =
        'linear-gradient(120deg, rgba(255, 0, 0, 0.5) 30%, rgba(21, 212, 0, 0.5) 70%)';
    } else {
      color = 'rgba(255, 255, 255, 0.5)';
      background = 'rgba(0, 0, 0, 0)';
    }

    return (
      <Button
        variant="contained"
        onClick={toggleRound}
        sx={{
          ...buttonSx,
          color,
          border: '1px solid black',
          background,
        }}
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
