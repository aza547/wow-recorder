import { TextField } from '@mui/material';
import { AppState } from 'main/types';
import { useState } from 'react';
import VideoFilter from './VideoFilter';

interface IProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const SearchBar = (props: IProps) => {
  const { appState, setAppState } = props;
  const [searchText, setSearchText] = useState<string>('');
  const { category } = appState;
  let debounceSearchTimer: NodeJS.Timer;

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
    }, 1500);
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
