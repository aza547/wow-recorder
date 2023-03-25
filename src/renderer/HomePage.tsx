import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import WorkIcon from '@mui/icons-material/Work';
import { Box, ListItemButton, ListItemIcon } from '@mui/material';
import { VideoCategory } from 'types/VideoCategory';
import { TNavigatorState } from 'main/types';

const categories = Object.values(VideoCategory);

interface IProps {
  setNavigationState: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { setNavigationState } = props;

  const handleClick = (category: VideoCategory) => {
    setNavigationState({
      categoryIndex: categories.indexOf(category),
      videoIndex: -1,
    });
  };

  const getCategoryListItem = (category: string) => {
    return (
      <ListItemButton
        key={category}
        onClick={() => handleClick(category as VideoCategory)}
      >
        <ListItemIcon>
          <WorkIcon />
        </ListItemIcon>
        <ListItemText primary={category} />
      </ListItemButton>
    );
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      sx={{
        width: '100%',
        height: 'calc(100% - 70px)',
        padding: '0',
        color: 'white',
      }}
    >
      <List
        component="nav"
        sx={{ border: '1px solid black', borderRadius: '1%' }}
      >
        {categories.map(getCategoryListItem)}
      </List>
    </Box>
  );
};

export default HomePage;
