import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { makeStyles } from 'tss-react/mui';
import { configSchema } from 'main/configSchema';
import GeneralSettings from './GeneralSettings';
import VideoSettings from './VideoSettings';
import AudioSettings from './AudioSettings';
import AdvancedSettings from './AdvancedSettings';
import ContentSettings from './ContentSettings';
import useSettings, { setConfigValues } from './useSettings';

const ipc = window.electron.ipcRenderer;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          <Typography component="span">{children}</Typography>
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `vertical-tab-${index}`,
    'aria-controls': `vertical-tabpanel-${index}`,
  };
}

export default function Settings() {
  const [config, setConfig] = useSettings();
  const [tabIndex, setTabIndex] = React.useState(0);

  const modifyConfig = (event: any): void => {
    const setting = event.target.name as keyof typeof configSchema;
    let { value } = event.target;

    switch (configSchema[setting].type) {
      case 'integer':
        value = parseInt(value, 10);
        break;

      case 'boolean':
        value = event.target.checked;
        break;

      case 'string':
        value = String(value);
        break;

      default:
        console.error('Unexpected default case hit');
    }

    console.debug('Modify config', { setting, value });

    setConfig((prevConfig: any) => ({ ...prevConfig, [setting]: value }));
  };

  const handleChangeTab = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  /**
   * Close window.
   */
  const closeSettings = () => {
    ipc.sendMessage('settingsWindow', ['quit']);
  };

  /**
   * Save values.
   */
  const saveSettings = () => {
    console.info('[Settings] User clicked save settings');

    setConfigValues(config);

    closeSettings();
    ipc.sendMessage('settingsWindow', ['update']);
  };

  const categoryTabsSx = {
    borderColor: '#000000',
    bgcolor: '#272e48',
    textColor: 'secondary',
    overflow: 'visible',
    borderRight: '1px solid',
  };

  const categoryTabSx = {
    padding: '12px',
    bgcolor: '#272e48',
    color: 'white',
    borderBottom: '1px solid',
    borderColor: 'black',
    minHeight: '1px',
    height: '50px',
    width: '150px',
  };

  /**
   * Needed to style the tabs with the right color.
   */
  const useStyles = makeStyles()({
    tabs: {
      '& .MuiTab-root.Mui-selected': {
        color: '#bb4220',
      },
      scrollButtons: {
        // this does nothing atm
        '&.Mui-disabled': {
          opacity: 1,
        },
      },
    },
  });

  /**
   * MUI styles.
   */
  const { classes: styles } = useStyles();

  return (
    <Box
      sx={{
        flexGrow: 1,
        bgcolor: 'background.paper',
        display: 'flex',
        height: '100%',
      }}
    >
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={tabIndex}
        onChange={handleChangeTab}
        aria-label="Vertical tabs example"
        sx={{ ...categoryTabsSx }}
        className={styles.tabs}
        TabIndicatorProps={{ style: { background: '#bb4220' } }}
      >
        <Tab label="General" {...a11yProps(0)} sx={{ ...categoryTabSx }} />
        <Tab label="Content" {...a11yProps(1)} sx={{ ...categoryTabSx }} />
        <Tab label="Video" {...a11yProps(2)} sx={{ ...categoryTabSx }} />
        <Tab label="Audio" {...a11yProps(3)} sx={{ ...categoryTabSx }} />
        <Tab label="Advanced" {...a11yProps(4)} sx={{ ...categoryTabSx }} />
      </Tabs>
      <TabPanel value={tabIndex} index={0}>
        <GeneralSettings config={config} onChange={modifyConfig} />
      </TabPanel>
      <TabPanel value={tabIndex} index={1}>
        <ContentSettings config={config} onChange={modifyConfig} />
      </TabPanel>
      <TabPanel value={tabIndex} index={2}>
        <VideoSettings config={config} onChange={modifyConfig} />
      </TabPanel>
      <TabPanel value={tabIndex} index={3}>
        <AudioSettings config={config} onChange={modifyConfig} />
      </TabPanel>
      <TabPanel value={tabIndex} index={4}>
        <AdvancedSettings config={config} onChange={modifyConfig} />
      </TabPanel>
      <div style={{ position: 'fixed', bottom: '10px', left: '12px' }}>
        <button
          type="button"
          id="close"
          name="close"
          className="btn btn-secondary"
          onClick={closeSettings}
        >
          Close
        </button>
        <button
          type="button"
          id="submit"
          name="save"
          className="btn btn-primary"
          onClick={saveSettings}
        >
          Save
        </button>
      </div>
    </Box>
  );
}
