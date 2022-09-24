import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { makeStyles } from 'tss-react/mui';
import GeneralSettings from './GeneralSettings';
import VideoSettings from './VideoSettings';
import AudioSettings from './AudioSettings';
import AdvancedSettings from './AdvancedSettings';
import ContentSettings from './ContentSettings';

const ipc = window.electron.ipcRenderer;
const settingsPages = [GeneralSettings, VideoSettings, AudioSettings, AdvancedSettings];

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
        <Box sx={{ p: 3 }}>
          <Typography>{children}</Typography>
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
  const [value, setValue] = React.useState(0);
  

  /**
   * Close window.
   */
  const closeSettings = () => {
    ipc.sendMessage('settingsWindow', ['quit']);
  }

  /**
   * Save values. 
   */
  const saveSettings = () => {
    settingsPages.forEach((s) => {console.log(s)});
  }


  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const videoTabsSx = {
    bgcolor: '#272e48' ,
    textColor: 'secondary',
    overflow: 'visible',
    borderTop: '1px solid black',
    borderBottom: '1px solid black',
    borderLeft: '1px solid black',
    borderRight: '1px solid black',
    height: '600px'
  };

  const categoryTabSx = {
    padding:'12px', 
    bgcolor: '#272e48', 
    color: 'white', 
    borderBottom: '1px solid', 
    borderColor: 'black', 
    minHeight: '1px', 
    height: '50px',
    width: '150px'
  }

/**
 * Needed to style the tabs with the right color.
 */
const useStyles = makeStyles()({
  tabs: {
    "& .MuiTab-root.Mui-selected": {
      color: '#bb4220'
    },
    scrollButtons: { // this does nothing atm
      "&.Mui-disabled": {
        opacity: 1
      }
    }
  },
})

  /**
  * MUI styles.
  */
   const { classes: styles } = useStyles();

  return (
    <Box
      sx={{ flexGrow: 1, bgcolor: 'background.paper', display: 'flex', height: '100%' }}
    >
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={value}
        onChange={handleChange}
        aria-label="Vertical tabs example"
        sx= {{ ...videoTabsSx }}
        className={ styles.tabs }
        TabIndicatorProps={{ style: { background:'#bb4220' } }}
      >
        <Tab label="General" {...a11yProps(0)} sx = {{ ...categoryTabSx }} />
        <Tab label="Content" {...a11yProps(1)} sx = {{ ...categoryTabSx }}/>
        <Tab label="Video" {...a11yProps(2)} sx = {{ ...categoryTabSx }}/>
        <Tab label="Audio" {...a11yProps(3)} sx = {{ ...categoryTabSx }}/>
        <Tab label="Advanced" {...a11yProps(4)} sx = {{ ...categoryTabSx }}/>
      </Tabs>
      <TabPanel value={value} index={0}>
        <GeneralSettings/>
      </TabPanel>
      <TabPanel value={value} index={1}>
        <ContentSettings/>
      </TabPanel>
      <TabPanel value={value} index={2}>
        <VideoSettings/>
      </TabPanel>
      <TabPanel value={value} index={3}>
        <AudioSettings/>
      </TabPanel>
      <TabPanel value={value} index={4}>
        <AdvancedSettings/>
      </TabPanel>
      <div style={{position: "fixed", bottom: "10px", left: "12px"}} >
        <button type="button" id="close" name="close" className="btn btn-secondary" onClick={closeSettings} >Close</button>
        <button type="button" id="submit" name="save" className="btn btn-primary" onClick={saveSettings}>Save</button>
      </div>
    </Box>
  );
}