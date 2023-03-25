import { Home } from '@mui/icons-material';
import { Button, IconButton, Menu, MenuItem, Stack } from '@mui/material';
import { TNavigatorState } from 'main/types';
import React from 'react';
import { VideoCategory } from 'types/VideoCategory';

interface IProps {
  navigation: TNavigatorState;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
  videostate: any;
}

const categories = Object.values(VideoCategory);

const Navigator: React.FC<IProps> = (props: IProps) => {
  const { navigation, setNavigation, videostate} = props;

  const [categoryMenuAnchor, setCategoryMenuAnchor] =
    React.useState<null | HTMLElement>(null);

  const categoryMenuOpen = Boolean(categoryMenuAnchor);

  const handleClose = () => {
    setCategoryMenuAnchor(null);
  };

  const goHome = () => {
    setNavigation({
      categoryIndex: -1,
      videoIndex: -1,
    });
  };

  const toggleCategoryMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setCategoryMenuAnchor(event.currentTarget);
  };

  const selectCategory = (category: VideoCategory) => {
    setCategoryMenuAnchor(null);
    setNavigation({
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

  const getVideoButtonText = (): string => {
    if (navigation.videoIndex < 0) {
      return 'Video';
    }

    const category = categories[navigation.categoryIndex];
    const video = videostate[category][navigation.videoIndex];
    return `${category} - ${video.date} - ${video.time}`;
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
          {getVideoButtonText()}
        </Button>
      </Stack>
    </>
  );
};

export default Navigator;
