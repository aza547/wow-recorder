import { Box, Typography } from '@mui/material';
import { VideoCategory } from 'types/VideoCategory';
import { Bar, BarChart, Legend, Pie, PieChart } from 'recharts';
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

  // Bit hacky
  let latestVideoPath;

  if (videoState.latestCategory !== undefined) {
    const latestCategory = videoState.latestCategory as VideoCategory;
    latestVideoPath = videoState[latestCategory][0].fullPath;

    window.electron.ipcRenderer.sendMessage('prepareThumbnail', [
      latestVideoPath,
    ]);
  }

  // Even more hacky, but having the latestCategory field breaks the next stats functions.
  delete videoState.latestCategory;

  const storageUsage = Math.round(getTotalUsage(videoState) / 1024 ** 3);
  const maxUsage = Math.round(config.maxStorage);
  const numVideos = getNumVideos(videoState);
  const totalDurationHours = Math.round(getTotalDuration(videoState) / 60 ** 2);

  const storageData = [
    {
      name: 'Used',
      value: storageUsage,
      fill: 'darkgrey',
    },
    {
      name: 'Available',
      value: maxUsage - storageUsage,
      fill: '#bb4220',
    },
  ];

  const activityData = [
    {
      name: 'Page A',
      uv: 4000,
      pv: 2400,
      amt: 2400,
    },
    {
      name: 'Page B',
      uv: 3000,
      pv: 1398,
      amt: 2210,
    },
    {
      name: 'Page C',
      uv: 2000,
      pv: 9800,
      amt: 2290,
    },
    {
      name: 'Page D',
      uv: 2780,
      pv: 3908,
      amt: 2000,
    },
    {
      name: 'Page E',
      uv: 1890,
      pv: 4800,
      amt: 2181,
    },
    {
      name: 'Page F',
      uv: 2390,
      pv: 3800,
      amt: 2500,
    },
    {
      name: 'Page G',
      uv: 3490,
      pv: 4300,
      amt: 2100,
    },
  ];

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
        <Typography variant="h5">You have {numVideos} videos saved.</Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}
      >
        <Box sx={{ margin: '20px' }}>
          <PieChart
            width={250}
            height={250}
            margin={{ top: 15, right: 15, bottom: 15, left: 15 }}
          >
            <Legend layout="vertical" verticalAlign="top" align="center" />
            <Pie
              data={storageData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={75}
              labelLine={false}
              label={renderCustomizedLabel}
            />
          </PieChart>
          <Typography align="center">Disk Usage</Typography>
        </Box>
        <Box sx={{ margin: '20px' }}>
          <Box
            component="img"
            src={`${config.storagePath}/thumbnail.png`}
            sx={{
              border: '1px solid black',
              borderRadius: '1%',
              boxSizing: 'border-box',
              display: 'flex',
              height: '250px',
              width: '250px',
              objectFit: 'cover',
            }}
          />
          <Typography align="center">Latest Video</Typography>
        </Box>
        <Box sx={{ margin: '20px' }}>
          <BarChart width={250} height={250} data={activityData}>
            <Bar dataKey="uv" fill="#8884d8" />
          </BarChart>
          <Typography align="center">Recent Activity</Typography>
        </Box>
      </Box>
    </>
  );
};

export default HomePage;
