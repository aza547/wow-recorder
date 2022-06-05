import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { makeStyles } from '@mui/styles';

/**
 * Import all the zone backdrops.
 */
import bladesEdge from  "../../assets/wow/bladesedge-arena.png";
import dalaran from "../../assets/wow/dalaran-arena.jpg";
import nagrand from  "../../assets/wow/nagrand-arena.jpg";
import ruins from  "../../assets/wow/ruins-arena.png";
import robodrome from  "../../assets/wow/robodrome-arena.jpg";
import tigersPeak from "../../assets/wow/tigerspeak-arena.png";
import tolviron from  "../../assets/wow/tolviron-arena.png";
import blackrook  from "../../assets/wow/blackrook-arena.jpg";
import empyrean from  "../../assets/wow/empyrean-arena.jpg";
import ashamanesFall  from "../../assets/wow/ashamanesfall-arena.jpg";
import mugambala from  "../../assets/wow/mugambala.jpg";
import hookpoint  from "../../assets/wow/hookpoint-arena.jpg";
import maldraxxus from  "../../assets/wow/maldraxxus-arena.jpg";
import enigma  from "../../assets/wow/enigma-arena.png";

/**
 * List of arenas and their backdrop image.
 */
 const zoneBackdrops =  {
   1672: bladesEdge,
   617: dalaran,
   1505: nagrand,
   572: ruins,
   2167: robodrome,
   1134: tigersPeak,
   980: tolviron,
   1504: blackrook,
   2373: empyrean,
   1552: ashamanesFall,
   1911: mugambala,
   1825: hookpoint,
   2509: maldraxxus,
   2547: enigma
 };

/**
 * List of supported categories. Order is the order they show up in the GUI.
 */
const categories = [
  "2v2",
  "3v3",
  "Skirmish",
  "Solo Shuffle",
  "Mythic+",
  "Raids",
  "Battlegrounds"
];

/**
 * List of raids and their image.
 */
 const raids = {
  sepulcher: "../../assets/wow/sepulcher.jpg"
};



const zones = {
  // Arenas
  1672: "Blade's Edge Arena",
  617: "Dalaran Arena",
  1505: "Nagrand Arena",
  572: "Ruins of Lordaeron",
  2167: "The Robodrome",
  1134: "Tiger's Peak",
  980: "Tol'Viron Arena",
  1504: "Black Rook Hold Arena",
  2373: "Empyrean Domain",
  1552: "Ashamane's Fall",
  1911: "Mugambala",
  1825: "Hook Point",
  2509: "Maldraxxus Coliseum",
  2547: "Enigma Crucible"
  // Raids
  // Dungeons
  // Battlegrounds
}
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
      videoState: window.electron.ipcRenderer.sendSync('getVideoState', categories)
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
  window.electron.ipcRenderer.on('refreshState', () => {
    setState(prevState => {
      return {
        ...prevState,
        videoState: window.electron.ipcRenderer.sendSync('getVideoState', categories)
        }
      }
    )
  });

  // for debugging
  console.log(state.videoState);

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
    let encounter;
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

    // Get the encounter name as per below.
    //  Raid:    encounter name
    //  Arena:   bracket name
    //  BG:      BG name
    //  Mythic+: dungeon name
    if ((category === "2v2") || (category === "3v3") || (category === "Skirmish") || (category === "Solo Shuffle")) {
      encounter = category;
    } else if (category === "Raids") {
      encounter = category; // TODO fix this to actually show encounter.
    } else if (category === "Mythic+") {
      encounter = category; // TODO fix this to actually show dungeon name.
    } else if (category === "Battleground") {
      encounter = category; // TODO fix this to actually show BG name.
    } else {
      encounter = "bug?";
    }

    // Format duration so that its MM:SS.
    const durationDate = new Date(0);
    durationDate.setSeconds(state.videoState[category][index].duration);
    const formattedDuration = durationDate.toISOString().substr(14, 5);


    return(
      <Tab label={
        <div className={ "videoButton" } style={{ backgroundImage: `url(${zoneBackdrops[state.videoState[category][index].zoneID]})`}}>
          <div className='duration'>{ formattedDuration }</div>
          <div className='encounter'>{ encounter }</div>
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
          <video key = { state.videoState[category][state.videoIndex].fullPath } className="video" poster="file:///D:/Checkouts/wow-recorder/assets/poster.png" controls>
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
          <video key = "None" className="video" poster="file:///D:/Checkouts/wow-recorder/assets/poster-novideos.png"></video>
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
