import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';

interface IProps {
  max: number;
  value: number;
  disabled: boolean;
  setValue: (v: number) => void;
  step: number;
}

const ChatOverlaySlider = (props: IProps) => {
  const { max, value, disabled, setValue, step } = props;

  const handleChange = (_event: Event, newValue: number | number[]) => {
    setValue(newValue as number);
  };

  let sliderSx = {
    '& .MuiSlider-thumb': {
      color: 'white',
    },
    '& .MuiSlider-track': {
      color: '#bb4220',
    },
    '& .MuiSlider-rail': {
      color: '#bb4220',
    },
    '& .MuiSlider-active': {
      color: '#bb4220',
    },
  };

  if (disabled) {
    sliderSx = {
      '& .MuiSlider-thumb': {
        color: 'grey',
      },
      '& .MuiSlider-track': {
        color: 'grey',
      },
      '& .MuiSlider-rail': {
        color: 'grey',
      },
      '& .MuiSlider-active': {
        color: 'grey',
      },
    };
  }

  return (
    <Box sx={{ width: 150, ml: 2, mr: 2 }}>
      <Slider
        value={value}
        disabled={disabled}
        onChange={handleChange}
        valueLabelDisplay="auto"
        min={0}
        max={max}
        step={step}
        sx={sliderSx}
      />
    </Box>
  );
};

export default ChatOverlaySlider;
