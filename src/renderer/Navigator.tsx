import { Home } from '@mui/icons-material';
import { Button, IconButton, Menu, MenuItem, Stack } from '@mui/material';
import { TNavigatorState } from 'main/types';
import React from 'react';
import { VideoCategory } from 'types/VideoCategory';

interface IProps {
  navigation: TNavigatorState;
  setNavigationState: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const categories = Object.values(VideoCategory);

const Navigator: React.FC<IProps> = (props: IProps) => {
  const { navigation, setNavigationState } = props;

  const [categoryMenuAnchor, setCategoryMenuAnchor] =
    React.useState<null | HTMLElement>(null);

  const categoryMenuOpen = Boolean(categoryMenuAnchor);

  const handleClose = () => {
    setCategoryMenuAnchor(null);
  };

  const goHome = () => {
    setNavigationState({
      categoryIndex: -1,
      videoIndex: -1,
    });
  };

  const toggleCategoryMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setCategoryMenuAnchor(event.currentTarget);
  };

  const selectCategory = (category: VideoCategory) => {
    // @@@ TODO update selectedCategory config?
    setCategoryMenuAnchor(null);
    setNavigationState({
      categoryIndex: categories.indexOf(category),
      videoIndex: -1,
    });
  };

  const getCategoryButtonText = (): string => {
    if (navigation.categoryIndex < 0) {
      return 'Category';
    }

    return categories[navigation.categoryIndex];
  };

  return (
    <>
      <Stack spacing={1} direction="row" sx={{ height: '20px' }}>
        <IconButton
          component="label"
          onClick={goHome}
          sx={{
            color: 'white',
          }}
        >
          <Home />
        </IconButton>
        <Button
          variant="contained"
          onClick={toggleCategoryMenu}
          sx={{
            bgcolor: '#272e48',
            border: '1px solid black',
            borderRadius: '1',
          }}
        >
          {getCategoryButtonText()}
        </Button>
        <Menu
          id="categories-menu"
          anchorEl={categoryMenuAnchor}
          open={categoryMenuOpen}
          onClose={handleClose}
          MenuListProps={{
            'aria-labelledby': 'basic-button',
          }}
        >
          {categories.map((category: VideoCategory) => (
            <MenuItem key={category} onClick={() => selectCategory(category)}>
              {category}
            </MenuItem>
          ))}
        </Menu>
        <Button
          variant="contained"
          sx={{
            bgcolor: '#272e48',
            color: 'white',
            border: '1px solid black',
            borderRadius: '1',
          }}
        >
          Video
        </Button>
      </Stack>
    </>
  );
};

export default Navigator;
