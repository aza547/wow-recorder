import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import WorkIcon from '@mui/icons-material/Work';
import { Box, ListItemButton, ListItemIcon, Typography } from '@mui/material';
import { VideoCategory } from 'types/VideoCategory';
import { TNavigatorState } from 'main/types';
import icon from '../../assets/icon/large-icon.png';

const categories = Object.values(VideoCategory);

interface IProps {
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { setNavigation } = props;

  const handleClick = (category: VideoCategory) => {
    setNavigation({
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
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
        }}
      >
        <Box
          component="img"
          src={icon}
          sx={{
            height: '100px',
            width: '100px',
            objectFit: 'cover',
          }}
        />
        <Typography variant="h1">Warcraft Recorder</Typography>
        <Typography variant="h3">Welcome!</Typography>
      </Box>
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        sx={{
          width: '100%',
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
    </>
  );
};

export default HomePage;
