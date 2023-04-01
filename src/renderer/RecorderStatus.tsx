import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { IconButton, Tooltip } from '@mui/material';
import { RecStatus } from 'main/types';

// @@@ TODO make on click

interface IProps {
  recorderStatus: RecStatus;
}

export default function RecorderStatus(props: IProps) {
  const { recorderStatus } = props;

  const getAppropriateIcon = () => {
    if (recorderStatus === RecStatus.Recording) {
      return <FiberManualRecordIcon sx={{ width: '25px', height: '25px' }} />;
    }

    if (recorderStatus === RecStatus.ReadyToRecord) {
      return <VisibilityIcon sx={{ width: '25px', height: '25px' }} />;
    }

    if (recorderStatus === RecStatus.WaitingForWoW) {
      return <VisibilityOffIcon sx={{ width: '25px', height: '25px' }} />;
    }

    return <ReportProblemIcon sx={{ width: '25px', height: '25px' }} />;
  };

  const getAppropriateColor = () => {
    if (recorderStatus === RecStatus.Recording) {
      return 'red';
    }

    if (recorderStatus === RecStatus.InvalidConfig) {
      return 'yellow';
    }

    return 'white';
  };

  return (
    <Tooltip title="Status">
      <IconButton
        id="rec-status-button"
        type="button"
        // onClick={runTest}
        sx={{ padding: '2px', minWidth: '25px', color: getAppropriateColor() }}
      >
        {getAppropriateIcon()}
      </IconButton>
    </Tooltip>
  );
}
