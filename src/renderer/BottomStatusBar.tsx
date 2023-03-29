import { TNavigatorState } from 'main/types';
import Box from '@mui/material/Box';
import DiscordButton from './DiscordButton';
import LogButton from './LogButton';
import RecorderStatus from './RecorderStatus';
import SavingStatus from './SavingStatus';
import SettingsButton from './SettingsButton';
import TestButton from './TestButton';
import VersionUpdateWidget from './VersionUpdateWidget';
import Navigator from './Navigator';

interface IProps {
  navigation: TNavigatorState;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const BottomStatusBar: React.FC<IProps> = (props: IProps) => {
  const { navigation, setNavigation } = props;

  return (
    <Box
      sx={{
        borderTop: '1px solid black',
        height: '35px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div id="status-buttons" className="status-buttons">
        <RecorderStatus />
        <VersionUpdateWidget />
        <SavingStatus />
      </div>
      <div id="navigator">
        <Navigator navigation={navigation} setNavigation={setNavigation} />
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
