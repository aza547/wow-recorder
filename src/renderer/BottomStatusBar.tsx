import { TNavigatorState } from 'main/types';
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
  setNavigationState: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const BottomStatusBar: React.FC<IProps> = (props: IProps) => {
  const { navigation, setNavigationState } = props;

  return (
    <div id="status-bar">
      <div id="status-buttons" className="status-buttons">
        <RecorderStatus />
        <VersionUpdateWidget />
        <SavingStatus />
      </div>
      <div id="navigator">
        <Navigator
          navigation={navigation}
          setNavigationState={setNavigationState}
        />
      </div>
      <div className="app-buttons">
        <SettingsButton />
        <LogButton />
        <DiscordButton />
        <TestButton />
      </div>
    </div>
  );
};

export default BottomStatusBar;
