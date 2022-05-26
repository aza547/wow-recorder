import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { makeStyles} from '@mui/styles';

const categories = [
  "2v2",
  "3v3",
  "Skirmish",
  "Solo Shuffle",
  "Mythic+",
  "Raids",
  "Battlegrounds"
];

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
  const [videoIndex, setVideoIndex] = React.useState(0);
  const [category, setCategory] = React.useState("2v2");

  const classes = useStyles();
  let videoList = window.electron.ipcRenderer.sendSync('LIST-VIDEOS', category);
  let videoLocation = `D:/wow-recorder-files/${category}/`;

  const handleChangeCategory = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
    setCategory(categories[newValue]);
  };

  const handleChangeVideo = (event: React.SyntheticEvent, newValue: number) => {
    setVideoIndex(newValue);

    const videoElement = document.getElementById('video' + category);
    const videoPath = videoList[newValue];

    if (videoElement !== null) {
      videoElement.src = videoLocation + videoPath;
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '210px',
        display: 'flex'
      }}
    >
      <Tabs
        orientation="vertical"
        variant="standard"
        value={ value }
        onChange={ handleChangeCategory }
        aria-label="Vertical tabs example"
        sx={{  borderColor: '#000000', bgcolor: '#272e48' ,  textColor: 'secondary', width: '175px', overflow: 'visible'}}
        className={ classes.tabs }
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
          <source src={ videoLocation + videoList[videoIndex] } />
        </video>
        <Tabs
          value={videoIndex}
          onChange={ handleChangeVideo }
          variant="scrollable"
          scrollButtons="auto"
          aria-label="scrollable auto tabs example"
          sx={{  borderColor: '#000000', bgcolor: '#272e48' ,  textColor: 'secondary', overflow: 'visible'}}
          className={ classes.tabs }
          TabIndicatorProps={{style: { background:'#bb4220' }}}
        >
          { videoList.map(file => {
              return(
                <Tab label={file} sx = {{ padding:'12px', bgcolor: '#272e48', color: 'white', borderTop: '1px solid', borderLeft: '1px solid', borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '50px'}}/>
              )
            })
          }
        </Tabs>
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
      </TabPanel>
      <TabPanel value={value} index={4}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
      <TabPanel value={value} index={5}>
        <video className="video" id="videoRaids" poster="file:///D:/Checkouts/wow-recorder/assets/poster.png" controls>
          <source src={ videoLocation + videoList[videoIndex] } />
        </video>
        <Tabs
          value={videoIndex}
          onChange={ handleChangeVideo }
          variant="scrollable"
          scrollButtons="auto"
          aria-label="scrollable auto tabs example"
        >
          { videoList.map(file => {
              return(
                <Tab label={file} sx = {{ padding:'12px', bgcolor: '#272e48', color: 'white', borderTop: '1px solid', borderLeft: '1px solid', borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '50px'}}/>
              )
            })
          }
        </Tabs>
      </TabPanel>
      <TabPanel value={value} index={6}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
    </Box>
  );
}
