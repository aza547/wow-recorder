import DiscordButton from './DiscordButton';
import LogButton from './LogButton';
import RecorderStatus from './RecorderStatus';
import SavingStatus from './SavingStatus';
import SettingsButton from './SettingsButton';
import TestButton from './TestButton';
import VersionUpdateWidget from './VersionUpdateWidget';

export default function RendererTitleBar() {
  return (
    <div id="status-bar">
      <div id="status-buttons" className="status-buttons">
        <RecorderStatus />
        <VersionUpdateWidget />
        <SavingStatus />
      </div>
      <div id="status-text">Home -- 2v2 -- Video.mp4</div>
      <div className="app-buttons">
        <SettingsButton />
        <LogButton />
        <DiscordButton />
        <TestButton />
      </div>
    </div>
  );
}
