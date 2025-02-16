import { AppState, RendererVideo } from 'main/types';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import Label from './components/Label/Label';
import { LayoutGrid, TvMinimal } from 'lucide-react';
import { language } from 'eslint-plugin-prettier/recommended';
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
    const multiPlayerMode = value === 'true';
    let s = [...selectedVideos];

    if (multiPlayerMode) {
      // User has selected multi player mode. Fill up the 4 slots
      s = opts.slice(0, 4);
    } else {
      // Remove all but the first selected video now that we're switching out
      // of multiPlayerMode.
      s = s.slice(0, 1);
    }

    setAppState((prevState) => {
      return {
        ...prevState,
        multiPlayerMode,
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
        >
          <ToggleGroupItem value={'false'}>
            <TvMinimal />
          </ToggleGroupItem>
          <ToggleGroupItem value={'true'} disabled={!allowMultiPlayer}>
            <LayoutGrid />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
};

export default MultiPovPlaybackToggles;
