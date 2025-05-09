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

const MultiPovPlaybackToggles = (props: IProps) => {
  const { appState, setAppState, allowMultiPlayer, opts } = props;
  const { selectedVideos, multiPlayerMode, language } = appState;

  const onValueChange = (value: string) => {
    let s = [...selectedVideos];

    if (value === 'true') {
      // User has selected multi player mode. Fill up to 2 slots
      s = opts.slice(0, 2);
    } else {
      // Remove all but the first selected video now that we're switching out
      // of multiPlayerMode.
      s = s.slice(0, 1);
    }

    setAppState((prevState) => {
      return {
        ...prevState,
        multiPlayerMode: value === 'true',
        viewpointSelectionOpen: value === 'true',
        selectedVideos: s,
      };
    });
  };

  return (
    <div className="flex items-center gap-x-5">
      <div>
        <Label>{getLocalePhrase(language, Phrase.PlayerModeLabel)}</Label>
        <ToggleGroup
          type="single"
          value={multiPlayerMode.toString()}
          size="sm"
          onValueChange={onValueChange}
          variant="outline"
          className="border border-background"
        >
          <ToggleGroupItem value="false">
            <TvMinimal size={18} />
          </ToggleGroupItem>
          <ToggleGroupItem value="true" disabled={!allowMultiPlayer}>
            <LayoutGrid size={18} />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
};

export default MultiPovPlaybackToggles;
