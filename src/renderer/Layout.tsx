import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { makeStyles } from 'tss-react/mui';
import { categories, videoTabsSx, categoryTabSx, categoryTabsSx, VideoCategory }  from '../main/constants';
import VideoButton  from './VideoButton';

/**
 * Import video posters.
 */
import readyPoster  from  "../../assets/poster/ready.png";
import notReadyPoster from  "../../assets/poster/not-ready.png";
import { dungeon } from './images';
import { VideoPlayerSettings } from 'main/types';
import { getConfigValue, setConfigValue } from 'settings/useSettings';

/**
 * For shorthand referencing.
 */
const ipc = window.electron.ipcRenderer;

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
        <Box sx={{ p: 0, width: "100%" }}>
          <Typography component={'span'} sx={{ width: "100%" }}>{children}</Typography>
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
 * Get video player settings initially when the component is loaded. We store 
 * as a variable in main rather than in config It's fine if this is lost when
 * the app is restarted. 
 */
const videoPlayerSettings = (ipc.sendSync('videoPlayerSettings', ['get']) as VideoPlayerSettings);
const selectedCategory = getConfigValue<number>('selectedCategory');

let videoState: { [key: string]: any } = {}

/**
 * The GUI itself.
 */
export default function Layout() {

  const [state, setState] = React.useState({
    categoryIndex: selectedCategory,
    videoIndex: 0,
    videoState,
    videoMuted: videoPlayerSettings.muted,
    videoVolume: videoPlayerSettings.volume, // (Double) 0.00 - 1.00
    videoSeek: 0,
  });

  const getVideoPlayer = () => {
    return (document.getElementById('video-player') as HTMLMediaElement);
  }

  /**
   * Read and store the video player state of 'volume' and 'muted' so that we may
   * restore it when selecting a different video.
   */
  const handleVideoPlayerVolumeChange = (event: any) => {
    const videoPlayerSettings = {
      muted: event.target.muted,
      volume: event.target.volume,
    };

    state.videoMuted = videoPlayerSettings.muted;
    state.videoVolume = videoPlayerSettings.volume;

    ipc.sendMessage('videoPlayerSettings', ['set', videoPlayerSettings]);
  }

  /**
   * Update the state variable following a change of selected category.
   */
  const handleChangeCategory = (_event: React.SyntheticEvent, newValue: number) => {
    setConfigValue('selectedCategory', newValue);

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
        videoIndex: newValue,
        videoSeek: 0,
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
  const { classes: styles } = useStyles();

  // This is effectively equivalent to componentDidMount() in
  // React Component classes
  React.useEffect(() => {
      /**
       * Refresh handler.
       */
      ipc.on('refreshState', async () => {
        videoState = await ipc.invoke('getVideoState', categories);
        setState(prevState => {
          return {
            ...prevState,
            videoState,
          }
        })
      });

      /**
       * Attach listener for seeking in the video on load/unload
       */
      ipc.on('seekVideo', (vIndex, vSeekTime) => {
        setState(prevState => {
          return {
            ...prevState,
            videoIndex: parseInt((vIndex as string), 10),
            videoSeek: parseInt((vSeekTime as string), 10),
          }
        });
      });
    },
    // From React documentation:
    //
    // > It's important to note the empty array as second argument for the
    // > Effect Hook which makes sure to trigger the effect only on component
    // > load (mount) and component unload (unmount).
    []
  );

  /**
   * When a new video is selected, let's set the video player volume and mute state
   */
   React.useEffect(() => {
    const video = getVideoPlayer()
    if (video) {
      video.muted = state.videoMuted;
      video.volume = state.videoVolume;
    }

  }, [state.videoIndex]);

  React.useEffect(() => {
    const videoPlayer = getVideoPlayer();
    if (videoPlayer) {
      videoPlayer.currentTime = state.videoSeek;
    }
  }, [state.videoSeek]);

  /**
   * Returns TSX for the tab buttons for category selection.
   */
  const generateTab = (tabIndex: number) => {
    const category = categories[tabIndex];
    const key = "tab" + tabIndex;

    return (
      <Tab key={ key } label={ category } {...a11yProps(tabIndex)} sx = {{ ...categoryTabSx }}/>
    )
  };

  /**
   * Returns a video panel where no videos are present.
   */
  const noVideoPanel = (index: number) => {
    const categoryIndex = state.categoryIndex;
    const key = "noVideoPanel" + index;

    return (
      <TabPanel key={ key } value={ categoryIndex } index={ index }>
        <div className="video-container">
          <video key="None" className="video" poster={ notReadyPoster }></video>
        </div>
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
    const isMythicPlus = (video.category === VideoCategory.MythicPlus && video.challengeMode !== undefined)
    let videoPoster = readyPoster;

    // Show a poster of the dungeon for M+ instead of "Select a video"
    if (isMythicPlus) {
      videoPoster = dungeon[video.challengeMode.zoneId];
    }

    return (
      <TabPanel key={ key } value={ categoryIndex } index={ index }>
        <div className={ 'video-container' + (isMythicPlus ? ' mythic-keystone' : '')}>
          <video
            key={ videoFullPath }
            id='video-player'
            className="video"
            poster={ videoPoster }
            onVolumeChange={ handleVideoPlayerVolumeChange }
            controls>
            <source src={ videoFullPath } />
          </video>
        </div>
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
    if (!(category in state.videoState)) {
      return noVideoPanel(tabIndex);
    }

    const haveVideos = state.videoState[category][state.videoIndex];

    if (!haveVideos) {
      return noVideoPanel(tabIndex);
    }

    return videoPanel(tabIndex);
  };

  const tabNumbers = [...Array(7).keys()];
  const categoryIndex = state.categoryIndex;

  return (
    <Box sx={{ width: '250px', height: '210px', display: 'flex' }}>
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
