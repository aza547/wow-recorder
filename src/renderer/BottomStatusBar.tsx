import { TNavigatorState } from 'main/types';
import DiscordButton from './DiscordButton';
import LogButton from './LogButton';
import RecorderStatus from './RecorderStatus';
import SavingStatus from './SavingStatus';
import SettingsButton from './SettingsButton';
import TestButton from './TestButton';
import VersionUpdateWidget from './VersionUpdateWidget';
import Navigator from './Navigator';
import Box from '@mui/material/Box';

interface IProps {
  navigation: TNavigatorState;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
  videostate: any;
}

const BottomStatusBar: React.FC<IProps> = (props: IProps) => {
  const { navigation, setNavigation, videostate } = props;

  return (
    <Box
      sx={{
        position: 'absolute',
        border: '1px solid black',
        height: '35px',
        width: '100%',
        bottom: '0px',
      }}
    >
      <div id="status-buttons" className="status-buttons">
        <RecorderStatus />
        <VersionUpdateWidget />
        <SavingStatus />
      </div>
      <div id="navigator">
        <Navigator
          navigation={navigation}
          setNavigation={setNavigation}
          videostate={videostate}
        />
      </div>
      <div className="app-buttons">
        <SettingsButton />
        <LogButton />
        <DiscordButton />
        <TestButton />
      </div>
    </Box>
  );
};

export default BottomStatusBar;
