import { AppState, RendererVideo } from 'main/types';
import { useState } from 'react';
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
import { X } from 'lucide-react';
import React from 'react';

import CloudIcon from '@mui/icons-material/Cloud';
import SaveIcon from '@mui/icons-material/Save';

import {
  CalendarDays,
  Eye,
  Gamepad2,
  Hash,
  Hourglass,
  MapPinned,
  MessageSquare,
  Swords,
  Trophy,
} from 'lucide-react';

import { faDragon, faMessage, faStar } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface IProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  categoryState: RendererVideo[];
}

const SearchBar = (props: IProps) => {
  const { appState, setAppState, categoryState } = props;

  const [suggestions, setSuggestions] = useState<Tag[]>(
    VideoFilter.getCategorySuggestions(categoryState),
  );

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

  const renderIcon = (icon: string, color: string) => {
    const muiIconPropsSx = {
      height: '25px',
      width: '25px',
      mr: '4px',
      color,
    };

    if (icon === '<SaveIcon>') {
      return <SaveIcon sx={muiIconPropsSx} />;
    }

    if (icon === '<CloudIcon>') {
      return <CloudIcon sx={muiIconPropsSx} />;
    }

    if (icon === '<CalendarDays>') {
      return (
        <CalendarDays
          className="mr-1"
          color={color}
          height="25px"
          width="25px"
        />
      );
    }

    if (icon === '<StarIcon>') {
      return (
        <FontAwesomeIcon
          icon={faStar}
          className="mr-1"
          height="25px"
          width="25px"
          color={color}
        />
      );
    }

    if (icon === '<TagIcon>') {
      return (
        <FontAwesomeIcon
          icon={faMessage}
          className="mr-1"
          height="25px"
          width="25px"
          color={color}
        />
      );
    }

    if (icon === '<DragonIcon>') {
      return (
        <FontAwesomeIcon
          icon={faDragon}
          height="25px"
          width="25px"
          className="mr-1"
          color={color}
        />
      );
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
          mr: '4px',
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

    const [, , icon] = option.value.split('   ');

    return (
      <div className={classes.join(' ')} {...optionProps}>
        <div className="flex items-center font-sans font-bold text-[12px] truncate">
          {renderIcon(icon, '#bb4420')}
          {option.label}
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
    console.log('dd');
    if (typeof tag.value !== 'string') {
      // Technically tags can have value of a few types but we only ever use strings.
      return <></>;
    }

    // A limitation of the react-tag-autocomplete library is that it doesn't allow
    // for custom tag types, so to avoid upsetting typescript we pass some info
    // as part of the value; speically that is the icon and color of the tag.
    const [, , icon, color] = tag.value.split('   ');
    console.log('icon', icon);

    return (
      <button
        type="button"
        className={`${classNames.tag}`}
        style={{ backgroundColor: color }}
        {...tagProps}
      >
        <div className="flex items-center font-sans text-black font-bold text-[12px] truncate">
          {renderIcon(icon, 'white')}
          {tag.label}
          <X size={20} className="ml-1" />
        </div>
      </button>
    );
  };

  const alphabeticalLabelSort = (a: Tag, b: Tag) => {
    if (typeof a.value !== 'string' || typeof b.value !== 'string') {
      return 0;
    }

    if (a.value < b.value) {
      return -1;
    }

    if (a.value < b.value) {
      return 1;
    }

    return 0;
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
          tagList: 'react-tags__list',
          tagListItem: 'react-tags__list-item',
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
        suggestions={suggestions.sort(alphabeticalLabelSort)}
        onAdd={onAdd}
        onDelete={onDelete}
        placeholderText="Start typing..."
      />
    </div>
  );
};

export default SearchBar;
