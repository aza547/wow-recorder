import { AppState, RendererVideo } from 'main/types';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import Label from './components/Label/Label';
import { LayoutGrid, TvMinimal } from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/types';

interface IProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  allowMultiPlayer: boolean;
  opts: RendererVideo[];
}

const ViewpointDisplayToggles = (props: IProps) => {
  const { appState, setAppState, allowMultiPlayer, opts } = props;
  const { selectedVideos, multiPlayerMode, language } = appState;

  return (
    <div className="flex items-center gap-x-5">
      <div>
        <Label>Viewpoints</Label>
        <ToggleGroup
          type="single"
          value={multiPlayerMode.toString()}
          size="sm"
          // onValueChange={onValueChange}
          variant="outline"
        >
          <ToggleGroupItem value="false">On</ToggleGroupItem>
          <ToggleGroupItem value="true">Off</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
};

export default ViewpointDisplayToggles;
