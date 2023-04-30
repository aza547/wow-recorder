import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import FormLabel from '@mui/material/FormLabel';
import { ISettingsPanelProps } from 'main/types';
import { Box, Switch } from '@mui/material';

export default function ContentSettings(props: ISettingsPanelProps) {
  const { config, onChange } = props;
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

  const getSwitch = (preference: string) => (
    <Switch
      sx={switchStyle}
      checked={Boolean(config[preference])}
      name={preference}
      onChange={onChange}
    />
  );

  return (
    <>
      <FormLabel id="radios" sx={formLabelStyle}>
        Game Type
      </FormLabel>
      <Divider color="black" />
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
      <Divider color="black" />
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
      <Divider color="black" />
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
}
