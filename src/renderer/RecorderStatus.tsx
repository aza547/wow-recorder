import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { IconButton, Tooltip } from '@mui/material';

// @@@ TODO make on click
// @@@ TODO change icon with state
export default function RecorderStatus() {
  return (
    <Tooltip title="View status">
      <IconButton
        id="test-button"
        type="button"
        // onClick={runTest}
        sx={{ padding: '2px', minWidth: '25px', color: 'white' }}
      >
        <VisibilityIcon sx={{ width: '25px', height: '25px' }} />
      </IconButton>
    </Tooltip>
  );
}
