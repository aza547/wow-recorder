import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import { ISettingsPanelProps } from 'main/types';
import { Box, TextField } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { configSchema } from '../main/configSchema';
import { obsResolutions } from '../main/constants';

const outputResolutions = Object.keys(obsResolutions);
const fpsOptions = ['10', '20', '30', '60'];

export default function VideoSettings(props: ISettingsPanelProps) {
  const { config, onChange } = props;

  const style = {
    width: '405px',
    color: 'white',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'black',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#bb4220',
    },
    '&.Mui-focused': {
      borderColor: '#bb4220',
      color: '#bb4220',
    },
    '& .MuiInputLabel-root': {
      color: 'white',
    },
  };

  const getBitrateTooltip = () => {
    return (
      <div>
        {configSchema.obsKBitRate.description}
        <br />
        <br />
        <table>
          <tr>
            <th>Quality</th>
            <th>30 FPS</th>
            <th>60 FPS</th>
          </tr>
          <tr>
            <td>720p</td>
            <td>7 Mbps</td>
            <td>10 Mbps</td>
          </tr>
          <tr>
            <td>1080p</td>
            <td>10 Mbps</td>
            <td>15 Mbps</td>
          </tr>
          <tr>
            <td>1440p</td>
            <td>20 Mbps</td>
            <td>30 Mbps</td>
          </tr>
          <tr>
            <td>2160p</td>
            <td>50 Mbps</td>
            <td>80 Mbps</td>
          </tr>
        </table>
      </div>
    );
  };

  return <></>;
}
