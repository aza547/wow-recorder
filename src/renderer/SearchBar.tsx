import { AppState, RendererVideo } from 'main/types';
import { KeyboardEventHandler, useEffect, useRef, useState } from 'react';
import { getLocalePhrase } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';
import VideoFilter from './VideoFilter';
import Label from './components/Label/Label';
import {
  InputRendererProps,
  OptionRendererProps,
  ReactTags,
  Tag,
  TagRendererProps,
  ReactTagsAPI,
} from 'react-tag-autocomplete';
import { Box } from '@mui/material';
import {
  LockKeyhole,
  LockOpen,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import React from 'react';
import ShieldIcon from '@mui/icons-material/Shield';
import { MapPinned } from 'lucide-react';

import {
  faDragon,
  faDungeon,
  faMessage,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import VideoTag from './VideoTag';
import { LocalPolice } from '@mui/icons-material';
import HomeRepairServiceIcon from '@mui/icons-material/HomeRepairService';
import HourglassDisabledIcon from '@mui/icons-material/HourglassDisabled';

interface IProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  filteredState: RendererVideo[];
}

const SearchBar = (props: IProps) => {
  const { appState, setAppState, filteredState } = props;
  const { language, videoFilterTags } = appState;

  const api = useRef<ReactTagsAPI>(null);

  const alphabeticalValueSort = (a: Tag, b: Tag) => {
    return String(a.value).localeCompare(String(b.value));
  };

  // We filter this by current query so that we don't suggest things that are
  // no longer valid based on the already applied filter.
  const [suggestions, setSuggestions] = useState<Tag[]>(
    VideoFilter.getCategorySuggestions(filteredState, language).map((t) =>
      t.getAsTag(),
    ),
  );

  useEffect(() => {
    const s = VideoFilter.getCategorySuggestions(filteredState, language)
      .map((t) => t.getAsTag())
      .filter((t) => !videoFilterTags.map((i) => i.value).includes(t.value));

    setSuggestions(s);
  }, [filteredState, videoFilterTags, language]);

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

    if (icon === '<LockIcon>') {
      return <LockKeyhole height="15px" width="25px" color="white" />;
    }

    if (icon === '<LockOpenIcon>') {
      return <LockOpen height="15px" width="25px" color="white" />;
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

    // If they are a priest we don't want to have white text on a white bakground.
    const closeIconColor = decoded.color === '#FFFFFF' ? 'black' : 'white';
    const textClass = decoded.color === '#FFFFFF' ? 'text-black' : 'text-white';

    const twTagClass = [
      'flex',
      'items-center',
      'font-sans',
      'font-bold',
      'text-[12px]',
      'truncate',
      'gap-1',
      textClass,
    ].join(' ');

    return (
      <button
        type="button"
        className={`flex items-center ${classNames.tag}`}
        style={{ backgroundColor: decoded.color }}
        {...tagProps}
      >
        <div className={twTagClass}>
          {renderIcon(decoded.icon)}
          {tag.label}
        </div>
        <X size={20} className="ml-1" color={closeIconColor} />
      </button>
    );
  };

  const renderInput = ({
    classNames,
    inputWidth,
    ...inputProps
  }: InputRendererProps) => {
    const onKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        if (api.current) api.current.select();
      }

      inputProps?.onKeyDown?.(event);
    };

    return (
      <div className="flex items-center mx-3">
        <Search size={15} />
        <input
          className={classNames.input}
          style={{ width: inputWidth }}
          {...inputProps}
          onKeyDown={onKeyDown}
        />
      </div>
    );
  };

  const classNames = {
    root: 'relative flex items-center cursor-text w-full h-[38px] rounded-md border border-background bg-card text-sm text-foreground-lighter',
    rootIsActive: 'is-active',
    rootIsDisabled: 'is-disabled',
    rootIsInvalid: 'is-invalid',
    label: 'react-tags__label',
    tagList: 'flex items-center',
    tagListItem: 'react-tags__list-item inline-flex items-center',
    tag: 'h-8 p-1 px-2 mx-1 rounded-md text-white text-sm',
    tagName: 'react-tags__tag-name',
    comboBox: 'react-tags__combobox',
    input: 'react-tags__combobox-input mx-2 placeholder:text-foreground',
    listBox: 'react-tags__listbox  bg-card rounded-md border border-background',
    option: 'react-tags__listbox-option',
    optionIsActive: 'is-active',
    highlight: 'react-tags__listbox-option-highlight',
  };

  return (
    <div onKeyDown={(event) => event.stopPropagation()}>
      <Label htmlFor="search-bar">
        {getLocalePhrase(language, Phrase.SearchLabel)}
      </Label>
      <ReactTags
        ref={api}
        allowResize={false}
        classNames={classNames}
        renderLabel={() => <></>}
        renderTag={renderTag}
        renderOption={renderOption}
        renderInput={renderInput}
        selected={appState.videoFilterTags}
        suggestions={suggestions.sort(alphabeticalValueSort)}
        onAdd={onAdd}
        onDelete={onDelete}
        placeholderText={getLocalePhrase(language, Phrase.StartTyping)}
        activateFirstOption
        collapseOnSelect
        // Contains a placeholder that is replaced by the library.
        // https://github.com/i-like-robots/react-tag-autocomplete?tab=readme-ov-file#deletebuttontext-optional
        deleteButtonText={getLocalePhrase(language, Phrase.RemoveTagFromList)}
      />
    </div>
  );
};

export default SearchBar;
