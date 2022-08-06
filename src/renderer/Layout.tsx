import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { makeStyles } from '@mui/styles';
import { categories, videoTabsSx, categoryTabSx, categoryTabsSx }  from '../main/constants';
import VideoButton  from './VideoButton';

/**
 * Import video posters. 
 */
import readyPoster  from  "../../assets/poster/ready.png";
import notReadyPoster from  "../../assets/poster/not-ready.png";
import unsupportedPoster from  "../../assets/poster/unsupported.png";

/**
 * For shorthand referencing. 
 */
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
  const handleChangeCategory = (_event: React.SyntheticEvent, newValue: number) => {
    setState(prevState => {
      return {...prevState, categoryIndex: newValue, videoIndex: 0}
    })
  };

  /**
   * Update the state variable following a change of selected video.
   */
  const handleChangeVideo = (_event: React.SyntheticEvent, newValue: number) => {
    console.log("change");
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
        <Tab label={ categories[tabIndex] } {...a11yProps(tabIndex)} sx = {{ borderTop: '1px solid', ...categoryTabSx }}/>
       )
     } else {
      return (
        <Tab label={ categories[tabIndex] } {...a11yProps(tabIndex)} sx = {{ ...categoryTabSx }}/>
      );
     }
  };

  /**
   * Returns TSX for the video player and video selection tabs.
   */
  function generateTabPanel(tabIndex: number) {
    if ((tabIndex === 4) || (tabIndex === 6)) {
      return (
        <TabPanel value={ state.categoryIndex } index={ tabIndex }>
          <video key = "None" className="video" poster={ unsupportedPoster }></video>
          <div className="noVideos"></div>
        </TabPanel>
      );
    } else if (state.videoState[category][state.videoIndex]) {
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
            sx= {{ ...videoTabsSx }}
            className={ classes.tabs }
            TabIndicatorProps={{style: { background:'#bb4220' }}}
          >

          { state.videoState[category].map((file: any) => {
            return(
              <VideoButton key={file.fullPath} state={state} index={file.index}/>
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
        sx={{ ...categoryTabsSx }}
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
