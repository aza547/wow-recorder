import { AppState, RendererVideo } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import RaidSelectionTable from './RaidSelectionTable';

interface IProps {
  category: VideoCategory;
  videoState: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const VideoSelectionTable = (props: IProps) => {
  const { videoState, category, appState, setAppState } = props;

  if (category === VideoCategory.Raids) {
    return (
      <RaidSelectionTable
        videoState={videoState}
        appState={appState}
        setAppState={setAppState}
      />
    );
  }

  return <> </>;
};

export default VideoSelectionTable;
