import {
  AppState,
  RendererVideo,
  SearchBarSuggestion,
  SearchBarSuggestionSection,
} from 'main/types';
import { useEffect, useState } from 'react';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/types';
import VideoFilter from './VideoFilter';
import Label from './components/Label/Label';
import Autosuggest from 'react-autosuggest';
import { Box } from '@mui/material';
import { specImages } from './images';
import { specializationById } from 'main/constants';
import { getWoWClassColor } from './rendererutils';
import { faDragon } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface IProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  categoryState: RendererVideo[];
}

// This has to be outside the component else we don't clear
// it correctly on re-renders.
let debounceSearchTimer: NodeJS.Timeout;

const SearchBar = (props: IProps) => {
  const { appState, setAppState, categoryState } = props;

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<SearchBarSuggestionSection[]>(
    [],
  );

  useEffect(() => {
    // We need this so we reset the search on changing category.
    // Not really sure why the whole component isn't re-created.
    setSearchText(appState.videoFilterQuery);
  }, [appState.videoFilterQuery]);

  const debouncedFilter = (value: string) => {
    setSearchText(value);

    if (debounceSearchTimer) {
      clearTimeout(debounceSearchTimer);
    }

    debounceSearchTimer = setTimeout(() => {
      setAppState((prevState) => {
        return {
          ...prevState,
          videoFilterQuery: value,
        };
      });
    }, 1000);
  };

  const onSuggestionsFetchRequested = ({ value }) => {
    const sections = VideoFilter.getSuggestions(categoryState);
    const filtered: SearchBarSuggestionSection[] = [];

    sections.forEach((section) => {
      const filteredSection = {
        title: section.title,
        suggestions: section.suggestions.filter((suggestion) =>
          suggestion.value.toLowerCase().startsWith(value.toLowerCase()),
        ),
      };

      if (filteredSection.suggestions.length > 0) {
        filtered.push(filteredSection);
      }
    });

    setSuggestions(filtered);
  };

  const onSuggestionsClearRequested = () => {
    setSuggestions([]);
  };

  const onSuggestionSelected = (event, { suggestionValue }) => {
    setAppState((prevState) => {
      return {
        ...prevState,
        videoFilterQuery: suggestionValue,
      };
    });
  };

  const onChange = (event, { newValue, method }) => {
    setSearchText(newValue);
    debouncedFilter(newValue);
  };

  const inputProps = {
    placeholder: 'Start typing...',
    value: searchText,
    onChange,
    spellCheck: false,
    onKeyDown: (e) => e.stopPropagation(),
  };

  const renderSuggestion = (s: SearchBarSuggestion) => {
    const playerSpecID = s.specID;

    if (playerSpecID) {
      const specIcon = specImages[playerSpecID as keyof typeof specImages];
      const playerClass = specializationById[playerSpecID].class;
      const playerClassColor = getWoWClassColor(playerClass);

      return (
        <div className="flex ">
          <Box
            key={s.value}
            component="img"
            src={specIcon}
            sx={{
              display: 'flex',
              height: '25px',
              width: '25px',
              border: '1px solid black',
              borderRadius: '15%',
              boxSizing: 'border-box',
              objectFit: 'cover',
            }}
          />
          <div
            className="font-sans font-semibold text-md text-shadow-instance mx-1"
            style={{ color: playerClassColor }}
          >
            {s.value}
          </div>
        </div>
      );
    }

    if (s.icon === 'Encounter') {
      return (
        <div className="flex items-center">
          <FontAwesomeIcon icon={faDragon} color="white" />
          {/* <Box
            key={s.value}
            component="img"
            src={faDragon}
            sx={{
              display: 'flex',
              height: '25px',
              width: '25px',
              border: '1px solid black',
              borderRadius: '15%',
              boxSizing: 'border-box',
              objectFit: 'cover',
            }}
          /> */}
          <div className="font-sans font-semibold text-md text-shadow-instance mx-1 text-primary-foreground">
            {s.value}
          </div>
        </div>
      );
    }

    return <div className="flex">{s.value}</div>;
  };

  const theme = {
    container: 'relative',
    input:
      'w-full flex h-10 w-full rounded-md border border-background bg-card px-3 py-2 text-sm ring-offset-primary text-foreground-lighter file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-popover-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed opacity-50',
    suggestionsContainer: 'absolute bg-card rounded-md w-full z-10',
    suggestion: 'px-4 py-2 cursor-pointer',
    suggestionHighlighted: 'bg-secondary rounded-md',
    sectionTitle: 'text-sm ring-offset-primary text-foreground-lighter p-2',
  };

  function getSectionSuggestions(section: SearchBarSuggestionSection) {
    return section.suggestions;
  }

  function renderSectionTitle(section: SearchBarSuggestionSection) {
    return <strong>{section.title}</strong>;
  }

  return (
    <div>
      <Label htmlFor="search-bar">
        {getLocalePhrase(appState.language, Phrase.SearchLabel)}
      </Label>
      <Autosuggest
        theme={theme}
        multiSection={true}
        suggestions={suggestions}
        onSuggestionsFetchRequested={onSuggestionsFetchRequested}
        onSuggestionsClearRequested={onSuggestionsClearRequested}
        onSuggestionSelected={onSuggestionSelected}
        getSuggestionValue={(s) => s.value}
        renderSectionTitle={renderSectionTitle}
        getSectionSuggestions={getSectionSuggestions}
        renderSuggestion={renderSuggestion}
        inputProps={inputProps}
      />

      {/* <Input
        className="w-full"
        spellCheck={false}
        placeholder={VideoFilter.getSuggestions(categoryState).join(' ')}
        id="search-bar"
        name="search-bar"
        value={searchText}
        onChange={debouncedFilter}
        onKeyDown={(e) => e.stopPropagation()}
      /> */}
    </div>
  );
};

export default SearchBar;
