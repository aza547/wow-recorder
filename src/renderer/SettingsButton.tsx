import { Button, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { Pages, TNavigatorState } from 'main/types';

interface IProps {
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

export default function SettingsButton(props: IProps) {
  const { setNavigation } = props;

  const goToSettingsPage = () => {
    setNavigation((prevState) => {
      return {
        ...prevState,
        page: Pages.Settings,
      };
    });
  };

  return (
    <Tooltip title="Settings">
      <Button
        id="settings-cog"
        type="button"
        onClick={goToSettingsPage}
        sx={{ padding: '2px', minWidth: '25px' }}
      >
        <SettingsIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
      </Button>
    </Tooltip>
  );
}
