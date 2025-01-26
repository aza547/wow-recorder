import { AppState, RendererVideo } from 'main/types';
import { useEffect, useState } from 'react';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/types';
import VideoFilter from './VideoFilter';
import Label from './components/Label/Label';
import {
  InputRendererProps,
  OptionRendererProps,
  ReactTags,
  Tag,
  TagRendererProps,
} from 'react-tag-autocomplete';
import { Box } from '@mui/material';
import { ThumbsDown, ThumbsUp, X } from 'lucide-react';
import React from 'react';
import ShieldIcon from '@mui/icons-material/Shield';
import CloudIcon from '@mui/icons-material/Cloud';
import SaveIcon from '@mui/icons-material/Save';
import { CalendarDays, MapPinned } from 'lucide-react';

import {
  faDragon,
  faDungeon,
  faMessage,
  faStar,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import VideoTag from './VideoTag';
import { LocalPolice } from '@mui/icons-material';
import HomeRepairServiceIcon from '@mui/icons-material/HomeRepairService';
import HourglassDisabledIcon from '@mui/icons-material/HourglassDisabled';

interface IProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  categoryState: RendererVideo[];
}

const SearchBar = (props: IProps) => {
  const { appState, setAppState, categoryState } = props;

  const alphabeticalValueSort = (a: Tag, b: Tag) => {
    return String(a.value).localeCompare(String(b.value));
  };

  const [suggestions, setSuggestions] = useState<Tag[]>(
    VideoFilter.getCategorySuggestions(categoryState, appState.language).map(
      (t) => t.getAsTag(),
    ),
  );

  useEffect(() => {
    // We need this so we reset the search on changing category.
    // Not really sure why the whole component isn't re-created.
    setSuggestions(
      VideoFilter.getCategorySuggestions(categoryState, appState.language).map(
        (t) => t.getAsTag(),
      ),
    );
  }, [appState.category]);

  const onAdd = (newTag: Tag) => {
    setAppState((prevState) => {
      return {
        ...prevState,
        videoFilterTags: [...appState.videoFilterTags, newTag],
      };
    });

    setSuggestions((prevSuggestions) => {
      return prevSuggestions.filter(
        (suggestion) => suggestion.value !== newTag.value,
      );
    });
  };

  const onDelete = (tagIndex: number) => {
    const deletedTag = appState.videoFilterTags[tagIndex];

    setAppState((prevState) => {
      return {
        ...prevState,
        videoFilterTags: appState.videoFilterTags.filter(
          (_, i) => i !== tagIndex,
        ),
      };
    });

    setSuggestions((prevSuggestions) => {
      return [...prevSuggestions, deletedTag];
    });
  };

  const renderIcon = (icon: string) => {
    const muiIconPropsSx = {
      height: '15px',
      width: '25px',
      color: 'white',
    };

    if (icon === '<SaveIcon>') {
      return <SaveIcon sx={muiIconPropsSx} />;
    }

    if (icon === '<CloudIcon>') {
      return <CloudIcon sx={muiIconPropsSx} />;
    }

    if (icon === '<Shield>') {
      return <ShieldIcon sx={muiIconPropsSx} />;
    }

    if (icon === '<Swords>') {
      return <LocalPolice sx={muiIconPropsSx} />;
    }

    if (icon === '<ChestIcon>') {
      return <HomeRepairServiceIcon sx={muiIconPropsSx} />;
    }

    if (icon === '<DepleteIcon>') {
      return <HourglassDisabledIcon sx={muiIconPropsSx} />;
    }

    if (icon === '<StarIcon>') {
      return (
        <FontAwesomeIcon
          icon={faStar}
          height="15px"
          width="25px"
          color="white"
        />
      );
    }

    if (icon === '<TagIcon>') {
      return (
        <FontAwesomeIcon
          icon={faMessage}
          height="15px"
          width="25px"
          color="white"
        />
      );
    }

    if (icon === '<DragonIcon>') {
      return (
        <FontAwesomeIcon
          icon={faDragon}
          height="15px"
          width="25px"
          color="white"
        />
      );
    }

    if (icon === '<DungeonIcon>') {
      return (
        <FontAwesomeIcon
          icon={faDungeon}
          height="15px"
          width="25px"
          color="white"
        />
      );
    }

    if (icon === '<ThumbsUp>') {
      return <ThumbsUp height="15px" width="25px" color="white" fill="white" />;
    }

    if (icon === '<ThumbsDown>') {
      return (
        <ThumbsDown height="15px" width="25px" color="white" fill="white" />
      );
    }

    if (icon === '<CalendarDays>') {
      return <CalendarDays height="15px" width="25px" color="white" />;
    }

    if (icon === '<MapPinned>') {
      return <MapPinned height="15px" width="25px" color="white" />;
    }

    return (
      <Box
        key={icon}
        component="img"
        src={icon}
        sx={{
          display: 'flex',
          height: '25px',
          width: '25px',
          border: '1px solid black',
          borderRadius: '15%',
          boxSizing: 'border-box',
          objectFit: 'cover',
          bgcolor: 'black',
        }}
      />
    );
  };

  const renderOption = ({
    classNames,
    option,
    ...optionProps
  }: OptionRendererProps) => {
    // Technically tags can have value of a few types but we only ever use strings.
    if (typeof option.value !== 'string') {
      return <></>;
    }

    const classes = [
      classNames.option,
      option.active ? 'is-active' : '',
      option.selected ? 'is-selected' : '',
    ];

    const tag = VideoTag.decode(option.value);

    return (
      <div className={classes.join(' ')} {...optionProps}>
        <div className="flex items-center font-sans font-bold text-[12px] truncate gap-1">
          {renderIcon(tag.icon)}
          {tag.label}
        </div>
      </div>
    );
  };

  /**
   * Custom tag rendering, the default is just a div with the tag label in
   * it, this function includes all that but also an icon, background coloring,
   * and appropriate styling.
   */
  const renderTag = ({ classNames, tag, ...tagProps }: TagRendererProps) => {
    if (typeof tag.value !== 'string') {
      // Technically tags can have value of a few types but we only ever use strings.
      return <></>;
    }

    // A limitation of the react-tag-autocomplete library is that it doesn't allow
    // for custom tag types. The workaround used here is to use the VideoTag class to
    // encapsulate all the required information into a string.
    const decoded = VideoTag.decode(tag.value);

    return (
      <button
        type="button"
        className={`flex items-center ${classNames.tag}`}
        style={{ backgroundColor: decoded.color }}
        {...tagProps}
      >
        <div className="flex items-center font-sans text-white font-bold text-[12px] truncate gap-1">
          {renderIcon(decoded.icon)}
          {tag.label}
        </div>
        <X size={20} className="ml-1" color="white" />
      </button>
    );
  };

  function renderInput({
    classNames,
    inputWidth,
    ...inputProps
  }: InputRendererProps) {
    return (
      <input
        className={classNames.input}
        style={{ width: inputWidth }}
        {...inputProps}
        onKeyDown={(event) => event.stopPropagation()}
      />
    );
  }

  return (
    <div>
      <Label htmlFor="search-bar">
        {getLocalePhrase(appState.language, Phrase.SearchLabel)}
      </Label>
      <ReactTags
        allowResize={false}
        classNames={{
          root: 'relative flex items-center cursor-text w-full h-10 rounded-md border border-background bg-card text-sm text-foreground-lighter',
          rootIsActive: 'is-active',
          rootIsDisabled: 'is-disabled',
          rootIsInvalid: 'is-invalid',
          label: 'react-tags__label',
          tagList: 'flex items-center',
          tagListItem: 'react-tags__list-item inline-flex items-center',
          tag: 'h-8 p-1 px-2 mx-1 rounded-md text-white text-sm',
          tagName: 'react-tags__tag-name',
          comboBox: 'react-tags__combobox',
          input: 'react-tags__combobox-input mx-2',
          listBox:
            'react-tags__listbox  bg-card rounded-md border border-background',
          option: 'react-tags__listbox-option',
          optionIsActive: 'is-active',
          highlight: 'react-tags__listbox-option-highlight',
        }}
        renderLabel={() => <></>}
        renderTag={renderTag}
        renderOption={renderOption}
        renderInput={renderInput}
        selected={appState.videoFilterTags}
        suggestions={suggestions.sort(alphabeticalValueSort)}
        onAdd={onAdd}
        onDelete={onDelete}
        placeholderText="Start typing..."
      />
    </div>
  );
};

export default SearchBar;
