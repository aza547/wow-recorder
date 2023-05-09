import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import { Box, Switch } from '@mui/material';
import { useSettings } from './useSettings';

const ContentSettings: React.FC = () => {
  const [config, setConfig] = useSettings();

  const formControlLabelStyle = { color: 'white' };
  const formLabelStyle = { color: 'white' };

  const switchStyle = {
    '& .MuiSwitch-switchBase': {
      '&.Mui-checked': {
        color: '#fff',
        '+.MuiSwitch-track': {
          backgroundColor: '#bb4220',
          opacity: 1.0,
        },
      },
      '&.Mui-disabled + .MuiSwitch-track': {
        opacity: 0.5,
      },
    },
  };

  // @@@ TODO
  const getSwitch = (preference: string) => (
    <Switch
      sx={switchStyle}
      // checked={true}
      name={preference}
      // onChange={}
    />
  );

  return (
    <>
      <FormLabel id="radios" sx={formLabelStyle}>
        Game Type
      </FormLabel>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          mt: 2,
          mb: 2,
        }}
      >
        <FormControlLabel
          control={getSwitch('recordRetail')}
          label="Retail"
          labelPlacement="bottom"
          style={formControlLabelStyle}
        />
        <FormControlLabel
          control={getSwitch('recordClassic')}
          label="Classic"
          labelPlacement="bottom"
          style={formControlLabelStyle}
        />
      </Box>
      <FormLabel id="radios" sx={formLabelStyle}>
        PvE
      </FormLabel>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          mt: 2,
          mb: 2,
        }}
      >
        <FormControlLabel
          control={getSwitch('recordRaids')}
          label="Raids"
          labelPlacement="bottom"
          style={formControlLabelStyle}
        />
        <FormControlLabel
          control={getSwitch('recordDungeons')}
          label="Mythic+"
          labelPlacement="bottom"
          style={formControlLabelStyle}
        />
      </Box>
      <FormLabel id="radios" sx={formLabelStyle}>
        PvP
      </FormLabel>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          mt: 2,
          mb: 2,
        }}
      >
        <FormControlLabel
          control={getSwitch('recordTwoVTwo')}
          label="2v2"
          labelPlacement="bottom"
          style={formControlLabelStyle}
        />
        <FormControlLabel
          control={getSwitch('recordThreeVThree')}
          label="3v3"
          labelPlacement="bottom"
          style={formControlLabelStyle}
        />
        <FormControlLabel
          control={getSwitch('recordFiveVFive')}
          label="5v5"
          labelPlacement="bottom"
          style={formControlLabelStyle}
        />
        <FormControlLabel
          control={getSwitch('recordSkirmish')}
          label="Skirmish"
          labelPlacement="bottom"
          style={formControlLabelStyle}
        />
        <FormControlLabel
          control={getSwitch('recordSoloShuffle')}
          label="Solo Shuffle"
          labelPlacement="bottom"
          style={formControlLabelStyle}
        />
        <FormControlLabel
          control={getSwitch('recordBattlegrounds')}
          label="Battlegrounds"
          labelPlacement="bottom"
          style={formControlLabelStyle}
        />
      </Box>
    </>
  );
};

export default ContentSettings;
