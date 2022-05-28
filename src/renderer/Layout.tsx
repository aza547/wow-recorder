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

  const [state, setState] = React.useState(() => {
    return {
      categoryIndex: 0,
      videoIndex: 0,
      videoList:  window.electron.ipcRenderer.sendSync('LIST-VIDEOS', "2v2")
    };
  });

  const handleChangeCategory = (event: React.SyntheticEvent, newValue: number) => {
    setState(() => {
      return {
        categoryIndex: newValue,
        videoIndex: 0,
        videoList: window.electron.ipcRenderer.sendSync('LIST-VIDEOS', categories[newValue])
      }
    })
  };

  const handleChangeVideo = (event: React.SyntheticEvent, newValue: number) => {
    setState(prevState => { return {...prevState, videoIndex: newValue} })
  };

  const category = categories[state.categoryIndex];
  const videoDir = `D:/wow-recorder-files/${category}/`;
  const absVideoPath = videoDir + state.videoList[state.videoIndex];
  const classes = useStyles();

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
        value={ state.categoryIndex }
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
      <TabPanel value={state.categoryIndex} index={0}>
        <video key = { absVideoPath } className="video" id="video2v2" poster="file:///D:/Checkouts/wow-recorder/assets/poster.png" controls>
          <source src={ absVideoPath } />
        </video>
        <Tabs
          value={state.videoIndex}
          onChange={ handleChangeVideo }
          variant="scrollable"
          scrollButtons="auto"
          aria-label="scrollable auto tabs example"
          sx={{  borderColor: '#000000', bgcolor: '#272e48' ,  textColor: 'secondary', overflow: 'visible'}}
          className={ classes.tabs }
          TabIndicatorProps={{style: { background:'#bb4220' }}}
        >
        { state.videoList.map(file => {
            return(
              <Tab label={file} sx = {{ padding:'12px', bgcolor: '#272e48', color: 'white', borderTop: '1px solid', borderLeft: '1px solid', borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '50px'}}/>
            )
          })
        }
        </Tabs>
      </TabPanel>
      <TabPanel value={state.categoryIndex} index={1}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
      <TabPanel value={state.categoryIndex} index={2}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
      <TabPanel value={state.categoryIndex} index={3}>
      </TabPanel>
      <TabPanel value={state.categoryIndex} index={4}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
      <TabPanel value={state.categoryIndex} index={5}>
        <video key = { absVideoPath } className="video" id="videoRaids" poster="file:///D:/Checkouts/wow-recorder/assets/poster.png" controls>
          <source src={ absVideoPath } />
        </video>
        <Tabs
          value={state.videoIndex}
          onChange={ handleChangeVideo }
          variant="scrollable"
          scrollButtons="auto"
          aria-label="scrollable auto tabs example"
        >
        { state.videoList.map(file => {
            return(
              <Tab label={file} sx = {{ padding:'12px', bgcolor: '#272e48', color: 'white', borderTop: '1px solid', borderLeft: '1px solid', borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '50px'}}/>
            )
          })
        }
        </Tabs>
      </TabPanel>
      <TabPanel value={state.categoryIndex} index={6}>
        <video className="video" controls>
          <source src="file:///D:/vid.mp4" />
        </video>
      </TabPanel>
    </Box>
  );
}
