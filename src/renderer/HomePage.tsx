import { Box, Divider, Typography } from '@mui/material';
import prettyBytes from 'pretty-bytes';
import icon from '../../assets/icon/large-icon.png';
import { getNumVideos, getTotalDuration, getTotalUsage } from './rendererutils';
import useSettings from '../settings/useSettings';
import { Legend, Pie, PieChart } from 'recharts';

interface IProps {
  videoState: any;
}

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { videoState } = props;
  const [config] = useSettings();
  console.log(videoState);

  const storageUsage = Math.round(getTotalUsage(videoState) / 1024 ** 3);
  const maxUsage = Math.round(config.maxStorage);
  const numVideos = getNumVideos(videoState);
  const totalDurationHours = Math.round(getTotalDuration(videoState) / 60 ** 2);

  const data = [
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

  const RADIAN = Math.PI / 180;
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
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

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
        <Typography variant="h5">Welcome!</Typography>
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
              data={data}
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
          <PieChart width={200} height={200}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={50}
              label
            />
          </PieChart>
          <Typography align="center">
            You have {numVideos} videos saved.
          </Typography>
        </Box>
        <Box sx={{ margin: '20px' }}>
          <PieChart width={200} height={200}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={50}
              label
            />
          </PieChart>
          <Typography align="center">
            That's {totalDurationHours} hours of footage.
          </Typography>
        </Box>
      </Box>
    </>
  );
};

export default HomePage;
