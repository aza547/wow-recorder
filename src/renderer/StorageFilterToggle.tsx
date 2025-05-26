import { AppState, RendererVideo, StorageFilter } from 'main/types';
import { Dispatch, SetStateAction } from 'react';
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

interface IProps {
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  table: Table<RendererVideo>;
  categoryState: RendererVideo[];
}

const StorageFilterToggle = (props: IProps) => {
  const { appState, setAppState, table, categoryState } = props;
  const { storageFilter, language } = appState;

  const hasDisk = categoryState.filter((rv) => !rv.cloud).length > 0;
  const hasCloud = categoryState.filter((rv) => rv.cloud).length > 0;

  const setStorageFilter = (storageFilter: StorageFilter) => {
    if (!storageFilter) {
      // Don't allow the user to toggle this off.
      return;
    }

    table.toggleAllRowsSelected(false);

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
      <ToggleGroupItem value={StorageFilter.DISK} disabled={!hasDisk}>
        <Tooltip
          content={getLocalePhrase(language, Phrase.ShowDiskOnlyTooltip)}
        >
          <SaveIcon sx={{ height: 18, width: 18 }} />
        </Tooltip>
      </ToggleGroupItem>

      <ToggleGroupItem value={StorageFilter.CLOUD} disabled={!hasCloud}>
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
