import { Home } from '@mui/icons-material';
import { Box, Chip, IconButton, Stack, Tooltip } from '@mui/material';
import { TNavigatorState } from 'main/types';
import React from 'react';
import { VideoCategory } from 'types/VideoCategory';
import Select from 'react-select';

interface IProps {
  navigation: TNavigatorState;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const categories = Object.values(VideoCategory);

const Navigator: React.FC<IProps> = (props: IProps) => {
  const { navigation, setNavigation } = props;

  let categorySelectValue;

  if (navigation.categoryIndex === -1) {
    categorySelectValue = null;
  } else {
    categorySelectValue = {
      value: categories[navigation.categoryIndex] as string,
      label: categories[navigation.categoryIndex] as string,
    };
  }

  const goHome = () => {
    setNavigation({
      categoryIndex: -1,
      videoIndex: -1,
    });
  };

  const options = categories.map((c) => ({ value: c, label: c }));

  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      background: '#fff',
      borderColor: '#9e9e9e',
      minHeight: '25px',
      height: '25px',
      boxShadow: state.isFocused ? null : null,
    }),

    valueContainer: (provided, state) => ({
      ...provided,
      height: '25px',
      padding: '0 6px',
    }),

    input: (provided, state) => ({
      ...provided,
      margin: '0px',
    }),
    indicatorSeparator: (state) => ({
      display: 'none',
    }),
    indicatorsContainer: (provided, state) => ({
      ...provided,
      height: '25px',
    }),
  };

  const goToSelection = (e) => {
    setNavigation((prevState) => {
      return {
        ...prevState,
        videoIndex: -1,
      };
    });
  };

  const onSelect = (event) => {
    let categoryIndex: number;

    if (event === null) {
      categoryIndex = -1;
    } else {
      categoryIndex = categories.indexOf(event.value);
    }

    setNavigation((prevState) => {
      return {
        ...prevState,
        categoryIndex,
      };
    });
  };

  const selectionChip = () => (
    <Chip
      label={categories[navigation.categoryIndex]}
      onClick={goToSelection}
      sx={{
        height: '20px',
        bottom: '16px',
        color: 'white',
        bgcolor: '#bb4420',
      }}
    />
  );

  return (
    <>
      <Box
        display="flex"
        sx={{
          height: '35px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack
          spacing={1}
          direction="row"
          sx={{ height: '25px', color: 'black' }}
        >
          <Tooltip title="Home">
            <IconButton
              component="label"
              onClick={goHome}
              sx={{
                color: 'white',
              }}
            >
              <Home />
            </IconButton>
          </Tooltip>
          <Select
            options={options}
            isClearable
            escapeClearsValue
            menuPlacement="top"
            styles={customSelectStyles}
            components={{ SingleValue: selectionChip }}
            openMenuOnClick={false}
            isSearchable={false}
            onChange={onSelect}
            value={categorySelectValue}
            theme={(theme) => ({
              ...theme,
              colors: {
                ...theme.colors,
                primary: '#bb4420',
                primary75: '#bb4420',
                primary50: '#bb4420',
                primary25: '#bb4420',
              },
            })}
          />
        </Stack>
      </Box>
    </>
  );
};

export default Navigator;
