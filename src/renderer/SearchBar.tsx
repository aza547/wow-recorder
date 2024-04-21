import { TextField } from '@mui/material';
import { AppState } from 'main/types';
import { useEffect, useState } from 'react';
import VideoFilter from './VideoFilter';

interface IProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

// This has to be outside the component else we don't clear
// it correctly on re-renders.
let debounceSearchTimer: NodeJS.Timer;

const SearchBar = (props: IProps) => {
  const { appState, setAppState } = props;
  const [searchText, setSearchText] = useState<string>('');
  const { category } = appState;

  useEffect(() => {
    // We need this so we reset the search on changing category.
    // Not really sure why the whole component isn't re-created.
    setSearchText(appState.videoFilterQuery);
  }, [appState.videoFilterQuery]);

  const debouncedFilter = (event: React.BaseSyntheticEvent) => {
    const filterText = event.target.value;
    setSearchText(filterText);

    if (debounceSearchTimer) {
      clearTimeout(debounceSearchTimer);
    }

    debounceSearchTimer = setTimeout(() => {
      setAppState((prevState) => {
        return {
          ...prevState,
          videoFilterQuery: filterText,
        };
      });
    }, 1000);
  };

  return (
    <TextField
      fullWidth
      spellCheck={false}
      size="small"
      placeholder={VideoFilter.getSuggestions(category)}
      id="search-bar"
      value={searchText}
      onChange={debouncedFilter}
      // Need this so we don't trigger VideoPlayer keydown events
      onKeyDown={(e) => e.stopPropagation()}
      sx={{
        '& .MuiOutlinedInput-root': {
          '&.Mui-focused fieldset': { borderColor: '#bb4220' },
          '& > fieldset': { borderColor: 'black' },
          '&:hover fieldset': {
            borderColor: '#bb4220',
          },
        },
        '& label.Mui-focused': { color: '#bb4220' },
        input: { color: 'white' },
        height: '40px',
      }}
      inputProps={{ style: { color: 'white' } }}
    />
  );
};

export default SearchBar;
