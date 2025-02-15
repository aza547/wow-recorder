import { AppState } from 'main/types';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import Label from './components/Label/Label';
import { LayoutGrid, TvMinimal } from 'lucide-react';

interface IProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const MultiPovPlaybackToggles = (props: IProps) => {
  const { appState, setAppState } = props;
  const { selectedRow, selectedVideos, multiPlayerMode } = appState;

  const onValueChange = (value: string) => {
    if (!selectedRow) {
      return;
    }

    const multiPlayerMode = value === 'true';
    let s = [...selectedVideos];

    if (multiPlayerMode) {
      // Add 3 new videos. We just pick the first ones we come across here
      // that are available to us on the row, while avoiding duplicates.
      const opts = [
        selectedRow.original,
        ...selectedRow.original.multiPov,
      ].filter((rv) => {
        const n = rv.videoName;
        return !s.map((sv) => sv.videoName).includes(n);
      });
      s.push(...opts.slice(0, 4 - s.length));
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

  const render = () => {
    let hasMultiPov = false;

    if (selectedRow) {
      // We don't want multi player mode to be accessible if there isn't
      // multiple viewpoints, so check for that. Important to filter by
      // unique name here so we don't allow multi player mode for two
      // identical videos with different storage (i.e. disk/cloud).
      const opts = [selectedRow.original, ...selectedRow.original.multiPov];
      const names = opts.map((rv) => rv.videoName);
      const unique = [...new Set(names)];
      hasMultiPov = unique.length > 1;
    }

    return (
      <div>
        <Label>Player Mode</Label>
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
          <ToggleGroupItem value={'true'} disabled={!hasMultiPov}>
            <LayoutGrid />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  return <div className="flex items-center gap-x-5">{render()}</div>;
};

export default MultiPovPlaybackToggles;
