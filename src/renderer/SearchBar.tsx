import { AppState } from 'main/types';
import { useEffect, useState } from 'react';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/types';
import VideoFilter from './VideoFilter';
import { Input } from './components/Input/Input';
import Label from './components/Label/Label';

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
    <div>
      <Label htmlFor="search-bar">
        {getLocalePhrase(appState.language, Phrase.SearchLabel)}
      </Label>
      <Input
        className="w-full"
        spellCheck={false}
        placeholder={VideoFilter.getSuggestions(appState.language, category)}
        id="search-bar"
        name="search-bar"
        value={searchText}
        onChange={debouncedFilter}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default SearchBar;
