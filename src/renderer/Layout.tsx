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

/**
 * TabPanelProps
 */
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

/**
 * MUI TabPanel
 */
const TabPanel = (props: TabPanelProps) => {
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

/**
 * Some MUI specific props. 
 */
const a11yProps = (index: number) => {
  return {
    id: `vertical-tab-${index}`,
    'aria-controls': `vertical-tabpanel-${index}`,
  };
}

/**
 * Category tab borders. 
 */
const tabProps = (index: number) => {
  if (index == 0) {
    return {
      borderTop: '1px solid',
      ...categoryTabSx
    }
  } else {
    return {
      ...categoryTabSx
    }
  }
}

/**
 * The GUI itself. 
 */
export default function Layout() {

  const [state, setState] = React.useState({
    categoryIndex: 0,
    videoIndex: 0,
    videoState: ipc.sendSync('getVideoState', categories)
  });

  /**
   * Update the state variable following a change of selected category.
   */
  const handleChangeCategory = (_event: React.SyntheticEvent, newValue: number) => {
    setState(prevState => {
      return {
        ...prevState, 
        categoryIndex: newValue, 
        videoIndex: 0
      }
    })
  };

  /**
   * Update the state variable following a change of selected video.
   */
  const handleChangeVideo = (_event: React.SyntheticEvent, newValue: number) => {
    setState(prevState => { 
      return {
        ...prevState, 
        videoIndex: newValue
      } 
    })
  };

 /**
  * State dependant variables.
  */
  const category = categories[state.categoryIndex];

  /**
  * MUI styles.
  */
  const styles = useStyles(); 

  /**
   * Refresh handler.
   */
  ipc.on('refreshState', () => {
    setState(prevState => {
      return {
        ...prevState, 
        videoState: ipc.sendSync('getVideoState', categories)
      }
    })
  });

  /**
   * Returns TSX for the tab buttons for category selection.
   */
  const generateTab = (tabIndex: number) => {
    const category = categories[tabIndex];
    const key = "tab" + tabIndex;

    return (
      <Tab key={ key } label={ category } {...a11yProps(tabIndex)} sx = {{ ...tabProps(tabIndex) }}/>
    )
  };

  /**
   * Returns a video panel for a currently unsupported category.
   */
  const unsupportedVideoPanel = (index: number) => {
    const categoryIndex = state.categoryIndex;
    const key = "videoPanel" + index;

    return (
      <TabPanel key={ key } value={ categoryIndex } index={ index }>
        <video key = "None" className="video" poster={ unsupportedPoster }></video>
        <div className="noVideos"></div>
      </TabPanel>
    );
  }

  /**
   * Returns a video panel where no videos are present.
   */
  const noVideoPanel = (index: number) => {
    const categoryIndex = state.categoryIndex;
    const key = "noVideoPanel" + index;
    
    return (
      <TabPanel key={ key } value={ categoryIndex } index={ index }>
        <video key = "None" className="video" poster={ notReadyPoster }></video>
        <div className="noVideos"></div>
      </TabPanel>
    );
  }

  /**
   * Returns a video panel with videos. 
   */
  const videoPanel = (index: number) => {
    const categoryIndex = state.categoryIndex;
    const videoIndex = state.videoIndex;
    const categoryState = state.videoState[category];
    const video = state.videoState[category][state.videoIndex];
    const videoFullPath = video.fullPath;
    const key = "videoPanel" + index;

    return (
      <TabPanel key={ key } value={ categoryIndex } index={ index }>
        <video key = { videoFullPath } className="video" poster={ readyPoster } controls>
          <source src={ videoFullPath } />
        </video>
        <Tabs
          value={ videoIndex }
          onChange={ handleChangeVideo }
          variant="scrollable"
          scrollButtons="auto"
          aria-label="scrollable auto tabs example"
          sx= {{ ...videoTabsSx }}
          className={ styles.tabs }
          TabIndicatorProps={{ style: { background:'#bb4220' } }}
        >
        { categoryState.map((file: any) => {
            return(
              <VideoButton key={ file.fullPath } state={ state } index={ file.index }/>
            )
          })
        }
        </Tabs>
      </TabPanel>
    );
  } 

  /**
   * Returns TSX for the video player and video selection tabs.
   */
   const generateTabPanel = (tabIndex: number) => {
    const haveVideos = state.videoState[category][state.videoIndex];

    if (tabIndex === 4) {
      return unsupportedVideoPanel(tabIndex);
    } else if (!haveVideos) {
      return noVideoPanel(tabIndex);
    } else {
      return videoPanel(tabIndex);
    }   
  };

  const tabNumbers = [...Array(7).keys()];
  const categoryIndex = state.categoryIndex;
  
  return (
    <Box sx={{ width: '50%', height: '210px', display: 'flex' }}>
      <Tabs
        orientation="vertical"
        variant="standard"
        value={ categoryIndex }
        onChange={ handleChangeCategory }
        aria-label="Vertical tabs example"
        sx={{ ...categoryTabsSx }}
        className={ styles.tabs }
        TabIndicatorProps={{style: { background:'#bb4220' }}}>

        { tabNumbers.map((tabNumber: number) => {
            return(generateTab(tabNumber));
          })
        }
      </Tabs>

      { tabNumbers.map((tabNumber: number) => {
          return(generateTabPanel(tabNumber));
        })
      }
    </Box>
  );
}
