import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Video2v2 from './Video2v2';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      className="TabPanel"
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 0 }}>
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

export default function VerticalTabs() {
  const [value, setValue] = React.useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
      }}
    >
      <Tabs
        orientation="vertical"
        variant="fullWidth"
        value={value}
        onChange={handleChange}
        aria-label="Vertical tabs example"
        sx={{ borderRight: 3, borderColor: '#000000', bgcolor: '#505050' }}
      >
        <Tab label="2v2" {...a11yProps(0)} sx = {{ bgcolor: '#505050', color:'green', color: 'white', border: '1px solid', borderColor: 'black'}}/>
        <Tab label="3v3" {...a11yProps(1)} sx = {{ bgcolor: '#505050' , color: 'white', border: '1px solid', borderColor: 'black' }}/>
        <Tab label="Skirmish" {...a11yProps(2)} sx = {{ bgcolor: '#505050', color: 'white', border: '1px solid', borderColor: 'black' }} />
        <Tab label="Mythic+" {...a11yProps(3)} sx = {{  bgcolor: '#505050', color: 'white', border: '1px solid', borderColor: 'black' }}/>
        <Tab label="Raids" {...a11yProps(4)} sx = {{ bgcolor: '#505050', color: 'white', border: '1px solid', borderColor: 'black' }} />
        <Tab label="Battlegrounds" {...a11yProps(5)} sx = {{ bgcolor: '#505050', color: 'white', border: '1px solid', borderColor: 'black' }}/>
      </Tabs>
      <TabPanel value={value} index={0}>
        <Video2v2 />
      </TabPanel>
      <TabPanel value={value} index={1}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
      <TabPanel value={value} index={2}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
      <TabPanel value={value} index={3}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
      <TabPanel value={value} index={4}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
      <TabPanel value={value} index={5}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
    </Box>
  );
}
