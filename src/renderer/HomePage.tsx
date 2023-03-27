import { Box, Divider, Typography } from '@mui/material';
import prettyBytes from 'pretty-bytes';
import icon from '../../assets/icon/large-icon.png';
import { getNumVideos, getTotalDuration, getTotalUsage } from './rendererutils';
import useSettings from '../settings/useSettings';

interface IProps {
  videoState: any;
}

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { videoState } = props;
  const [config] = useSettings();
  console.log(videoState);

  const storageUsage = getTotalUsage(videoState);
  const maxUsage = config.maxStorage * 1024 ** 3;
  const numVideos = getNumVideos(videoState);
  const totalDurationHours = Math.round(getTotalDuration(videoState) / 60 ** 2);

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
        <Typography
          variant="h1"
          sx={{
            color: 'white',
            fontFamily: '"Arial Narrow","Arial",sans-serif',
          }}
        >
          Warcraft Recorder
        </Typography>
        <Typography variant="h5">Welcome!</Typography>
      </Box>
      <Box
        component="span"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <Box>You have {numVideos} videos saved.</Box>
        <Box>
          You are using {prettyBytes(storageUsage)} of {prettyBytes(maxUsage)}.
        </Box>
        <Box>That's {totalDurationHours} hours of footage</Box>
      </Box>
    </>
  );
};

export default HomePage;
