import { TextField } from '@mui/material';
import { TAppState, TNavigatorState } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import { useState } from 'react';
import VideoFilter from './VideoFilter';

interface IProps {
  navigation: TNavigatorState;
  setAppState: React.Dispatch<React.SetStateAction<TAppState>>;
}

const SearchBar = (props: IProps) => {
  const { navigation, setAppState } = props;
  const [searchText, setSearchText] = useState<string>('');

  const { categoryIndex } = navigation;
  let debounceSearchTimer: NodeJS.Timer;

  const categories = Object.values(VideoCategory);
  const category = categories[categoryIndex];

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
    }, 750);
  };

  return (
    <TextField
      fullWidth
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
