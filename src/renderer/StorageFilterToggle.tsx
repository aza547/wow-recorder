import { AppState, RendererVideo, StorageFilter } from 'main/types';
import { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import CloudIcon from '@mui/icons-material/Cloud';
import SaveIcon from '@mui/icons-material/Save';
import { Workflow } from 'lucide-react';
import { Tooltip } from './components/Tooltip/Tooltip';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { Table } from '@tanstack/react-table';
import StateManager from './StateManager';

interface IProps {
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  table: Table<RendererVideo>;
  stateManager: MutableRefObject<StateManager>;
}

const StorageFilterToggle = (props: IProps) => {
  const { appState, setAppState, table, stateManager } = props;
  const { storageFilter, language } = appState;

  const setStorageFilter = (storageFilter: StorageFilter) => {
    table.toggleAllRowsSelected(false);
    stateManager.current.updateStorageFilter(storageFilter);
    setAppState((prevState) => ({
      ...prevState,
      selectedVideos: [],
      storageFilter,
    }));
  };

  return (
    <ToggleGroup
      type="single"
      value={storageFilter}
      size="sm"
      onValueChange={setStorageFilter}
      variant="outline"
      className="border border-background"
    >
      <ToggleGroupItem value={StorageFilter.DISK}>
        <Tooltip
          content={getLocalePhrase(language, Phrase.ShowDiskOnlyTooltip)}
        >
          <SaveIcon sx={{ height: 18, width: 18 }} />
        </Tooltip>
      </ToggleGroupItem>

      <ToggleGroupItem value={StorageFilter.CLOUD}>
        <Tooltip
          content={getLocalePhrase(language, Phrase.ShowCloudOnlyTooltip)}
        >
          <CloudIcon sx={{ height: 18, width: 18 }} />
        </Tooltip>
      </ToggleGroupItem>

      <ToggleGroupItem value={StorageFilter.BOTH}>
        <Tooltip content={getLocalePhrase(language, Phrase.ShowBothTooltip)}>
          <Workflow size={18} />
        </Tooltip>
      </ToggleGroupItem>
    </ToggleGroup>
  );
};

export default StorageFilterToggle;
