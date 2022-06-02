import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { makeStyles} from '@mui/styles';

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

/**
 * List of arenas and their image.
 */
 const arenas = {
  sepulcher: "2v2"
};

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
      videoState: window.electron.ipcRenderer.sendSync('getVideoState', "2v2")
    };
  });

  /**
   * Update the state variable following a change of selected category.
   */
  const handleChangeCategory = (event: React.SyntheticEvent, newValue: number) => {
    setState(() => {
      return {
        categoryIndex: newValue,
        videoIndex: 0,
        videoState: window.electron.ipcRenderer.sendSync('getVideoState', categories[newValue])
      }
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
      if (state.videoState[index].result) {
        result = "Win";
      } else {
       result = "Loss";
     }
    } else {
      if (state.videoState[index].result) {
        result = "Kill";
      } else {
        result = "Wipe";
      }
    }

    // TODO make this conditonal on zone
    let klazz: string ="videoButton " + "sepulcherRaid";

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

    return(
      <Tab label={
        <div className={klazz}>
          <div className='duration'>{ state.videoState[index].duration }</div>
          <div className='encounter'>{ encounter }</div>
          <div className='zone'>{ state.videoState[index].zone }</div>
          <div className='time'>{ state.videoState[index].time }</div>
          <div className='date'>{ state.videoState[index].date }</div>
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
    return (
      <TabPanel value={ state.categoryIndex } index={ tabIndex }>
        <video key = { state.videoState[state.videoIndex].fullPath } className="video" poster="file:///D:/Checkouts/wow-recorder/assets/poster.png" controls>
          <source src={ state.videoState[state.videoIndex].fullPath } />
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
        { state.videoState.map(file => {
          return(
            generateVideoButton(file.name, file.index)
          )
        })}
        </Tabs>
      </TabPanel>
    );
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
