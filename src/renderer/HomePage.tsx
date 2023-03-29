import { Box, Typography } from '@mui/material';
import { VideoCategory } from 'types/VideoCategory';
import {
  Bar,
  BarChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TNavigatorState } from 'main/types';
import icon from '../../assets/icon/large-icon.png';
import {
  getNumVideos,
  getRecentActivityStats,
  getTotalUsage,
} from './rendererutils';
import useSettings from '../settings/useSettings';

interface IProps {
  videoState: any;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  index,
}) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
  const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { videoState, setNavigation } = props;
  const [config] = useSettings();
  console.log(videoState);

  // Bit hacky
  let latestCategory;
  if (videoState.latestCategory !== undefined) {
    latestCategory = videoState.latestCategory as VideoCategory;
    const latestVideoPath = videoState[latestCategory][0].fullPath;

    window.electron.ipcRenderer.sendMessage('prepareThumbnail', [
      latestVideoPath,
    ]);
  }

  const goToLatestVideo = () => {
    const categories = Object.values(VideoCategory);
    const categoryIndex = categories.indexOf(latestCategory as VideoCategory);

    // @@@ TODO fix, this gets reset when state is refreshed and we lose the latestCategory?
    // SO when we click this button twice we hit an error.
    setNavigation({
      categoryIndex,
      videoIndex: 0,
    });
  };

  const storageUsage = Math.round(getTotalUsage(videoState) / 1024 ** 3);
  const maxUsage = Math.round(config.maxStorage);
  const numVideos = getNumVideos(videoState);

  const storageData = [
    {
      name: 'Used',
      value: storageUsage,
      fill: '#bb4220',
    },
    {
      name: 'Available',
      value: maxUsage - storageUsage,
      fill: 'grey',
    },
  ];

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContet: 'center',
          flexDirection: 'column',
          margin: 2,
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
            color: '#bb4220',
            fontFamily: '"Arial",sans-serif',
          }}
        >
          Warcraft Recorder
        </Typography>
        <Typography
          variant="h5"
          sx={{
            color: 'white',
            fontFamily: '"Arial",sans-serif',
          }}
        >
          You have {numVideos} videos saved.
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          height: '100%',
        }}
      >
        <Box
          sx={{
            margin: '30px',
            width: '35%',
            height: '35%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <ResponsiveContainer>
            <PieChart margin={{ bottom: 20, top: 20, left: 20, right: 20 }}>
              <Legend layout="vertical" verticalAlign="top" align="center" />
              <Pie
                data={storageData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <Typography
            align="center"
            variant="h5"
            sx={{
              color: 'white',
              fontFamily: '"Arial","Arial",sans-serif',
            }}
          >
            Disk Usage
          </Typography>
        </Box>
        <Box
          sx={{
            margin: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            width: '100%',
          }}
        >
          <Box
            component="img"
            src={`${config.storagePath}/thumbnail.png`}
            onClick={goToLatestVideo}
            sx={{
              border: '1px solid black',
              borderRadius: 5,
              boxSizing: 'border-box',
              display: 'flex',
              width: '100%',
              objectFit: 'cover',
              '&:hover': {
                border: '1px solid #bb4420',
                color: 'gray',
                backgroundColor: 'lightblue',
              },
            }}
          />
          <Typography
            align="center"
            variant="h5"
            sx={{
              color: 'white',
              fontFamily: '"Arial",sans-serif',
            }}
          >
            Latest Video
          </Typography>
        </Box>
        <Box
          sx={{
            margin: '30px',
            width: '35%',
            height: '35%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <ResponsiveContainer>
            <BarChart
              data={getRecentActivityStats(videoState)}
              margin={{ bottom: 20, top: 20, left: 20, right: 20 }}
            >
              <Bar dataKey="Recordings" fill="#bb4420" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} />
              <YAxis interval={0} />
              <Tooltip />
            </BarChart>
          </ResponsiveContainer>
          <Typography
            align="center"
            variant="h5"
            sx={{
              color: 'white',
              fontFamily: '"Arial",sans-serif',
            }}
          >
            Recent Activity
          </Typography>
        </Box>
      </Box>
    </>
  );
};

export default HomePage;
