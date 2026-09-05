import { AppState, LockFilter } from 'main/types';
import { Dispatch, RefObject, SetStateAction } from 'react';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import { LockKeyhole, LockOpen, Workflow } from 'lucide-react';
import { Tooltip } from './components/Tooltip/Tooltip';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';

interface IProps {
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  persistentProgress: RefObject<number>;
}

const LockFilterToggle = (props: IProps) => {
  const { appState, setAppState, persistentProgress } = props;
  const { lockFilter, language } = appState;

  const setLockFilter = (lockFilter: LockFilter) => {
    if (!lockFilter) {
      // Don't allow the user to toggle this off.
      return;
    }

    persistentProgress.current = 0;
    setAppState((prevState) => ({
      ...prevState,
      lockFilter,
      selectedVideos: [],
      multiPlayerMode: false,
      playing: false,
    }));
  };

  return (
    <ToggleGroup
      type="single"
      value={lockFilter}
      size="sm"
      onValueChange={setLockFilter}
      variant="outline"
      className="border border-background"
    >
      <ToggleGroupItem value={LockFilter.LOCKED}>
        <Tooltip
          content={getLocalePhrase(language, Phrase.ShowLockedOnlyTooltip)}
          onClick={() => {}}
        >
          <LockKeyhole size={18} />
        </Tooltip>
      </ToggleGroupItem>

      <ToggleGroupItem value={LockFilter.UNLOCKED}>
        <Tooltip
          content={getLocalePhrase(language, Phrase.ShowUnlockedOnlyTooltip)}
          onClick={() => {}}
        >
          <LockOpen size={18} />
        </Tooltip>
      </ToggleGroupItem>

      <ToggleGroupItem value={LockFilter.ALL}>
        <Tooltip
          content={getLocalePhrase(language, Phrase.ShowAllLocksTooltip)}
          onClick={() => {}}
        >
          <Workflow size={18} />
        </Tooltip>
      </ToggleGroupItem>
    </ToggleGroup>
  );
};

export default LockFilterToggle;
