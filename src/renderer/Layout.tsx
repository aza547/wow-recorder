import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { makeStyles } from '@mui/styles';
import { categories }  from '../main/constants';

/**
 * Import the arena zone backdrops.
 */
import arenaBED from "../../assets/arena/BED.png";
import arenaDAL from "../../assets/arena/DAL.jpg";
import arenaNAG from "../../assets/arena/NAG.jpg";
import arenaROL from "../../assets/arena/ROL.png";
import arenaROB from "../../assets/arena/ROB.jpg";
import arenaTP  from "../../assets/arena/TP.png";
import arenaTOL from "../../assets/arena/TOL.png";
import arenaBRK from "../../assets/arena/BRK.jpg";
import arenaED  from "../../assets/arena/ED.jpg";
import arenaASH from "../../assets/arena/ASH.jpg";
import arenaMUG from "../../assets/arena/MUG.jpg";
import arenaHP  from "../../assets/arena/HP.jpg";
import arenaMAL from "../../assets/arena/MAL.jpg";
import arenaENI from "../../assets/arena/ENI.png";

/**
 * Import the dungeon zone backdrops.
 */
import dungeonTOP from "../../assets/dungeon/TOP.jpg";
import dungeonTVM from "../../assets/dungeon/TVM.jpg";
import dungeonHOA from "../../assets/dungeon/HOA.jpg";
import dungeonNW  from "../../assets/dungeon/NW.jpg";
import dungeonSOA from "../../assets/dungeon/SOA.jpg";
import dungeonPF  from "../../assets/dungeon/PF.jpg";
import dungeonSD  from "../../assets/dungeon/SD.jpg";
import dungeonDOS from "../../assets/dungeon/DOS.jpg";
import dungeonMTS from "../../assets/dungeon/MTS.jpg";

/**
 * Import the raid zone backdrops.
 */
 import raidSOFO  from "../../assets/raid/SOFO.jpg";

/**
 * Import video posters. 
 */
import readyPoster  from  "../../assets/poster/ready.png";
import notReadyPoster from  "../../assets/poster/not-ready.png";

/**
 * List of zones and their backdrop image.
 */
const zoneBackdrops =  {
  // Arenas
  1672: arenaBED,
  617:  arenaDAL,
  1505: arenaNAG,
  572:  arenaROL,
  2167: arenaROB,
  1134: arenaTP,
  980:  arenaTOL,
  1504: arenaBRK,
  2373: arenaED,
  1552: arenaASH,
  1911: arenaMUG,
  1825: arenaHP,
  2509: arenaMAL,
  2547: arenaENI,

  // Raids
  2537: raidSOFO,

  // Dungeons
  2291: dungeonDOS,
  2287: dungeonHOA,
  2290: dungeonMTS,
  2289: dungeonPF,
  2284: dungeonSD,
  2258: dungeonSOA,
  2286: dungeonNW,
  2293: dungeonTOP,
  2441: dungeonTVM
};

const ipc = window.electron.ipcRenderer;

/**
 * Needed to style the tabs with the right color.
 */
const useStyles = makeStyles({
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
          <Typography component={'span'}>{children}</Typography>
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

export default function Layout() {

  const [state, setState] = React.useState(() => {
    return {
      categoryIndex: 0,
      videoIndex: 0,
      videoState: ipc.sendSync('getVideoState', categories)
    };
  });

  /**
   * Update the state variable following a change of selected category.
   */
  const handleChangeCategory = (event: React.SyntheticEvent, newValue: number) => {
    setState(prevState => {
      return {...prevState, categoryIndex: newValue, videoIndex: 0}
    })
  };

  /**
   * Update the state variable following a change of selected video.
   */
  const handleChangeVideo = (event: React.SyntheticEvent, newValue: number) => {
    setState(prevState => { return {...prevState, videoIndex: newValue} })
  };



 /**
  * State dependant variables.
  */
  const category = categories[state.categoryIndex];

  const classes = useStyles();

  /**
   * Refresh handler.
   */
  ipc.on('refreshState', () => {
    setState(prevState => {
      return {
        ...prevState,
        videoState: ipc.sendSync('getVideoState', categories)
        }
      }
    )
  });

  /**
   * Returns TSX for the tab buttons for category selection, with an
   * additional border style for the 0th (top) tab.
   */
   function generateTab(tabIndex: number) {
     if (tabIndex === 0) {
       return (
        <Tab
        label={ categories[tabIndex] } {...a11yProps(tabIndex)}
        sx = {{ padding:'12px', bgcolor: '#272e48', color: 'white', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '30px'}}/>
       )
     } else {
      return (
        <Tab
        label={ categories[tabIndex] } {...a11yProps(tabIndex)}
        sx = {{ padding:'12px', bgcolor: '#272e48' , color: 'white', borderBottom: '1px solid', borderColor: 'black', minHeight: '1px', height: '30px' }}/>
      );
     }
  };

  /**
   * Reads the video file name and seperates out into useful parameter.
   */
   function generateVideoButton(file: string, index: number) {

    let result;
    const isPvp = (category === "2v2") || (category === "3v3") || (category === "Skirmish") || (category === "Solo Shuffle");

    // Get appropriate success/fail text for the content type.
    if (isPvp) {
      if (state.videoState[category][index].result) {
        result = "Win";
      } else {
       result = "Loss";
     }
    } else {
      if (state.videoState[category][index].result) {
        result = "Kill";
      } else {
        result = "Wipe";
      }
    }

    // Format duration so that its MM:SS.
    const durationDate = new Date(0);
    console.log(state.videoState);
    durationDate.setSeconds(state.videoState[category][index].duration);
    const formattedDuration = durationDate.toISOString().substr(14, 5);


    return(
      <Tab label={
        <div className={ "videoButton" } style={{ backgroundImage: `url(${zoneBackdrops[state.videoState[category][index].zoneID]})`}}>
          <div className='duration'>{ formattedDuration }</div>
          <div className='encounter'>{ state.videoState[category][index].encounter }</div>
          <div className='zone'>{ state.videoState[category][index].zone }</div>
          <div className='time'>{ state.videoState[category][index].time }</div>
          <div className='date'>{ state.videoState[category][index].date }</div>
          <div className='result'>{ result }</div>
        </div>
      }
      key={ file }
      sx={{ padding: '0px', borderLeft: '1px solid black', borderRight: '1px solid black', bgcolor: '#272e48', color: 'white', minHeight: '1px', height: '100px', width: '200px' }}/>
    )
  };

  /**
   * Returns TSX for the video player and video selection tabs.
   */
  function generateTabPanel(tabIndex: number) {
    if (state.videoState[category][state.videoIndex]) {
      return (
        <TabPanel value={ state.categoryIndex } index={ tabIndex }>
          <video key = { state.videoState[category][state.videoIndex].fullPath } className="video" poster={readyPoster} controls>
            <source src={ state.videoState[category][state.videoIndex].fullPath } />
          </video>
          <Tabs
            value={state.videoIndex}
            onChange={ handleChangeVideo }
            variant="scrollable"
            scrollButtons="auto"
            aria-label="scrollable auto tabs example"
            sx= {{
              position: 'fixed',
              bottom: '1px',
              left: '1px',
              width: '100%',
              borderColor: '#000000',
              bgcolor: '#272e48' ,
              textColor: 'secondary',
              overflow: 'visible',
              borderTop: '1px solid',
              borderBottom: '1px solid',
              borderLeft: '1px solid',
              borderRight: '1px solid'
            }}
            className={ classes.tabs }
            TabIndicatorProps={{style: { background:'#bb4220' }}}
          >
          { state.videoState[category].map(file => {
            return(
              generateVideoButton(file.name, file.index)
            )
          })}
          </Tabs>
        </TabPanel>
      );
    } else {
      return (
        <TabPanel value={ state.categoryIndex } index={ tabIndex }>
          <video key = "None" className="video" poster={ notReadyPoster }></video>
          <div className="noVideos"></div>
        </TabPanel>
      );
    }
  };

  
  return (
    <Box
      sx={{
        width: '50%',
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
        sx={{  borderColor: '#000000', bgcolor: '#272e48', textColor: 'secondary', width: '175px', overflow: 'visible'}}
        className={ classes.tabs }
        TabIndicatorProps={{style: { background:'#bb4220' }}} >
          { generateTab(0) }
          { generateTab(1) }
          { generateTab(2) }
          { generateTab(3) }
          { generateTab(4) }
          { generateTab(5) }
          { generateTab(6) }
      </Tabs>
        { generateTabPanel(0) }
        { generateTabPanel(1) }
        { generateTabPanel(2) }
        { generateTabPanel(3) }
        { generateTabPanel(4) }
        { generateTabPanel(5) }
        { generateTabPanel(6) }
    </Box>
  );
}
