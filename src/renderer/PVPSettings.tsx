import FormControlLabel from '@mui/material/FormControlLabel';
import { Box, Switch } from '@mui/material';
import { ConfigurationSchema } from 'main/configSchema';
import React from 'react';
import { setConfigValues, useSettings } from './useSettings';

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

const PVPSettings: React.FC = () => {
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      recordTwoVTwo: config.recordTwoVTwo,
      recordThreeVThree: config.recordThreeVThree,
      recordFiveVFive: config.recordFiveVFive,
      recordSkirmish: config.recordSkirmish,
      recordSoloShuffle: config.recordSoloShuffle,
      recordBattlegrounds: config.recordBattlegrounds,
    });
  }, [
    config.recordBattlegrounds,
    config.recordFiveVFive,
    config.recordSkirmish,
    config.recordSoloShuffle,
    config.recordThreeVThree,
    config.recordTwoVTwo,
  ]);

  const getSwitch = (
    preference: keyof ConfigurationSchema,
    changeFn: (event: React.ChangeEvent<HTMLInputElement>) => void
  ) => (
    <Switch
      sx={switchStyle}
      checked={Boolean(config[preference])}
      name={preference}
      onChange={changeFn}
    />
  );

  const getSwitchForm = (
    preference: keyof ConfigurationSchema,
    label: string,
    changeFn: (event: React.ChangeEvent<HTMLInputElement>) => void
  ) => {
    return (
      <FormControlLabel
        control={getSwitch(preference, changeFn)}
        label={label}
        labelPlacement="top"
        style={{ color: 'white' }}
      />
    );
  };

  const setRecord2v2 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordTwoVTwo: event.target.checked,
      };
    });
  };

  const setRecord3v3 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordThreeVThree: event.target.checked,
      };
    });
  };

  const setRecord5v5 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordFiveVFive: event.target.checked,
      };
    });
  };

  const setRecordSkirmish = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordSkirmish: event.target.checked,
      };
    });
  };

  const setRecordSolo = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordSoloShuffle: event.target.checked,
      };
    });
  };

  const setRecordBgs = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordBattlegrounds: event.target.checked,
      };
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}
    >
      {getSwitchForm('recordTwoVTwo', 'Record 2v2', setRecord2v2)}
      {getSwitchForm('recordThreeVThree', 'Record 3v3', setRecord3v3)}
      {getSwitchForm('recordFiveVFive', 'Record 5v5', setRecord5v5)}
      {getSwitchForm('recordSkirmish', 'Record Skirmish', setRecordSkirmish)}
      {getSwitchForm('recordSoloShuffle', 'Record Solo Shuffle', setRecordSolo)}
      {getSwitchForm(
        'recordBattlegrounds',
        'Record Battlegrounds',
        setRecordBgs
      )}
    </Box>
  );
};

export default PVPSettings;
