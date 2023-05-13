import * as React from 'react';
import Box from '@mui/material/Box';
import { FormControlLabel, Switch } from '@mui/material';
import { ConfigurationSchema } from 'main/configSchema';
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

const WindowsSettings = () => {
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      startUp: config.startUp,
      startMinimized: config.startMinimized,
      minimizeOnQuit: config.minimizeOnQuit,
      minimizeToTray: config.minimizeToTray,
    });
  }, [
    config.minimizeOnQuit,
    config.minimizeToTray,
    config.startMinimized,
    config.startUp,
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

  const setRunOnStartup = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        startUp: event.target.checked,
      };
    });
  };

  const setStartMinimized = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        startMinimized: event.target.checked,
      };
    });
  };

  const setMinimizeOnQuit = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        minimizeOnQuit: event.target.checked,
      };
    });
  };

  const setMinimizeToTray = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        minimizeToTray: event.target.checked,
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
      {getSwitchForm('startUp', 'Run on Startup', setRunOnStartup)}
      {getSwitchForm('startMinimized', 'Start Minimized', setStartMinimized)}
      {getSwitchForm('minimizeOnQuit', 'Minimize on Quit', setMinimizeOnQuit)}
      {getSwitchForm('minimizeToTray', 'Minimize to Tray', setMinimizeToTray)}
    </Box>
  );
};

export default WindowsSettings;
