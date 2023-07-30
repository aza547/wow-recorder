import { Box, Button } from '@mui/material';
import { useState } from 'react';
import { VideoCategory } from 'types/VideoCategory';
import { useSettings, setConfigValue } from './useSettings';

enum DeathMarkers {
  NONE = 'None',
  OWN = 'Own Only',
  ALL = 'All',
}

const buttonSx = {
  mx: 1,
  height: '40px',
  color: 'white',
  borderColor: 'white',
  ':hover': {
    color: '#bb4420',
    borderColor: '#bb4420',
  },
};

interface IProps {
  category: VideoCategory;
}

const VideoMarkerToggles = (props: IProps) => {
  const [config] = useSettings();
  const { category } = props;

  let initialDeathMarkers: DeathMarkers;

  if (config.deathMarkers === 0) {
    initialDeathMarkers = DeathMarkers.NONE;
  } else if (config.deathMarkers === 2) {
    initialDeathMarkers = DeathMarkers.ALL;
  } else {
    initialDeathMarkers = DeathMarkers.OWN;
  }

  const [deathSelection, setDeathSelection] =
    useState<DeathMarkers>(initialDeathMarkers);

  const [encounterSelection, setEncounterSelection] = useState<boolean>(
    config.encounterMarkers
  );
  const [roundSelection, setRoundSelection] = useState<boolean>(
    config.roundMarkers
  );

  const toggleDeaths = () => {
    const options = Object.values(DeathMarkers);
    const current = options.indexOf(deathSelection);
    const next = current < options.length - 1 ? current + 1 : 0;
    setDeathSelection(options[next]);

    if (options[next] === DeathMarkers.NONE) {
      setConfigValue('deathMarkers', 0);
    } else if (options[next] === DeathMarkers.ALL) {
      setConfigValue('deathMarkers', 2);
    } else {
      setConfigValue('deathMarkers', 1);
    }
  };

  const toggleEncounters = () => {
    setConfigValue('encounterMarkers', !encounterSelection);
    setEncounterSelection(!encounterSelection);
  };

  const toggleRound = () => {
    setConfigValue('roundMarkers', !roundSelection);
    setRoundSelection(!roundSelection);
  };

  const renderDeathSelection = () => {
    return (
      <Button variant="outlined" onClick={toggleDeaths} sx={buttonSx}>
        Deaths: {deathSelection}
      </Button>
    );
  };

  const renderEncounterSelection = () => {
    const text = encounterSelection ? 'ON' : 'OFF';

    return (
      <Button variant="outlined" onClick={toggleEncounters} sx={buttonSx}>
        Encounters: {text}
      </Button>
    );
  };

  const renderRoundSelection = () => {
    const text = roundSelection ? 'ON' : 'OFF';

    return (
      <Button variant="outlined" onClick={toggleRound} sx={buttonSx}>
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
