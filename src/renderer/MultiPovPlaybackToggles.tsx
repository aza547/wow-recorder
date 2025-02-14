import { VideoCategory } from 'types/VideoCategory';
import { useEffect, useRef } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import { AppState, DeathMarkers } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/types';
import { setConfigValues } from './useSettings';
import {
  convertNumToDeathMarkers,
  convertDeathMarkersToNum,
} from './rendererutils';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import Label from './components/Label/Label';

interface IProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const MultiPovPlaybackToggles = (props: IProps) => {
  const { appState, setAppState } = props;
  const { numVideoPlayers } = appState;

  const render = () => {
    return (
      <div>
        <Label>Multipov</Label>
        <ToggleGroup
          type="single"
          value={String(numVideoPlayers)}
          size="sm"
          onValueChange={(v) => {
            const numVideoPlayers = parseInt(v, 10) as 1 | 2 | 3 | 4;

            setAppState((prevState) => ({
              ...prevState,
              numVideoPlayers,
            }));
          }}
          variant="outline"
        >
          <ToggleGroupItem value={String(1)}>1</ToggleGroupItem>
          <ToggleGroupItem value={String(2)}>2</ToggleGroupItem>
          <ToggleGroupItem value={String(3)}>3</ToggleGroupItem>
          <ToggleGroupItem value={String(4)}>4</ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };

  return <div className="flex items-center gap-x-5">{render()}</div>;
};

export default MultiPovPlaybackToggles;
