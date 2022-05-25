import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Video2v2 from './Video2v2';
import { makeStyles} from '@mui/styles';

const useStyles = makeStyles({
  tabs: {
    "& .MuiTab-root.Mui-selected": {
      color: '#bb4220'
    }
  }
})

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
  const classes = useStyles();

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleChange2v2 = () => {
    const selectionBox: any = document!.getElementById('select2v2')!;
    const selection: any = selectionBox.value;
    const videoPath: any = "D:/wow-recorder-files/2v2/" + selection;
    const videoElement: any = document!.getElementById('video2v2')!;
    videoElement.src = videoPath;
  };

  const handleChangeRaid = () => {
    const selectionBox: any = document!.getElementById('selectRaid')!;
    const selection: any = selectionBox.value;
    const videoPath: any = "D:/wow-recorder-files/Raids/" + selection;
    const videoElement: any = document!.getElementById('videoRaid')!;
    videoElement.src = videoPath;
  };

  function getFirstVideo() {
    return "file:///D:/wow-recorder-files/2v2/" + window.electron.ipcRenderer.sendSync('LIST', [])[0];
  }

  function getVideoList() {
    return window.electron.ipcRenderer.sendSync('LIST', []);
  }

  function getFirstSoloVideo() {
    return "file:///D:/wow-recorder-files/Solo Shuffle/" + window.electron.ipcRenderer.sendSync('LISTSOLO', [])[0];
  }

  function getFirstRaidVideo() {
    return "file:///D:/wow-recorder-files/Raids/" + window.electron.ipcRenderer.sendSync('LISTRAID', [])[0];
  }

  function getSoloVideoList() {
    return window.electron.ipcRenderer.sendSync('LISTSOLO', []);
  }

  function getRaidVideoList() {
    return window.electron.ipcRenderer.sendSync('LISTRAID', []);
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '210px',
        display: 'flex',
      }}
    >
      <Tabs
        orientation="vertical"
        variant="standard"
        value={value}
        onChange={handleChange}
        aria-label="Vertical tabs example"
        sx={{  borderColor: '#000000', bgcolor: '#272e48' ,  textColor: 'secondary'}}
        className={classes.tabs}
        TabIndicatorProps={{style: { background:'#bb4220' }}}
      >
        <Tab label="2v2" {...a11yProps(0)} sx = {{ padding:'12px', bgcolor: '#272e48', color: 'white', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '30px'}}/>
        <Tab label="3v3" {...a11yProps(1)} sx = {{ padding:'12px', bgcolor: '#272e48' , color: 'white', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '30px' }} />
        <Tab label="Skirmish" {...a11yProps(2)} sx = {{ padding:'12px', bgcolor: '#272e48', color: 'white', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '30px' }} />
        <Tab label="Solo Shuffle" {...a11yProps(2)} sx = {{ padding:'12px', bgcolor: '#272e48', color: 'white', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '30px' }} />
        <Tab label="Mythic+" {...a11yProps(3)} sx = {{  padding:'12px', bgcolor: '#272e48', color: 'white', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '30px' }}/>
        <Tab label="Raids" {...a11yProps(4)} sx = {{ padding:'12px', bgcolor: '#272e48', color: 'white', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '30px' }} />
        <Tab label="Battlegrounds" {...a11yProps(5)} sx = {{ padding:'12px', bgcolor: '#272e48', color: 'white', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '30px' }}/>
      </Tabs>
      <TabPanel value={value} index={0}>
        <video className="video" id="video2v2" poster="file:///D:/Checkouts/wow-recorder/assets/poster.png" controls>
          <source src={ getFirstVideo() } />
        </video>
        <select id="select2v2" onChange={ handleChange2v2 }>
        { getVideoList().map(file => {
            return(
              <option value={file} key={file}>{file}</option>
            )
          })
        }
        </select>
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
        <video className="video" id="videoSolo" poster="file:///D:/Checkouts/wow-recorder/assets/poster.png" controls>
          <source src={ getFirstSoloVideo() } />
        </video>
        <select id="select2v2" onChange={ handleChange2v2 }>
        { getSoloVideoList().map(file => {
            return(
              <option value={file} key={file}>{file}</option>
            )
          })
        }
        </select>
      </TabPanel>
      <TabPanel value={value} index={4}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
      <TabPanel value={value} index={5}>
        <video className="video" id="videoRaid" poster="file:///D:/Checkouts/wow-recorder/assets/poster.png" controls>
          <source src={ getFirstRaidVideo() } />
        </video>
        <select id="selectRaid" onChange={ handleChangeRaid }>
        { getRaidVideoList().map(file => {
            return(
              <option value={file} key={file}>{file}</option>
            )
          })
        }
        </select>
      </TabPanel>
      <TabPanel value={value} index={6}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
    </Box>
  );
}
