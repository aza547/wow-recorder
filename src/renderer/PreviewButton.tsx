import { Button, Tooltip } from '@mui/material';
import PreviewIcon from '@mui/icons-material/Preview';
import { TNavigatorState } from 'main/types';

interface IProps {
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

export default function PreviewButton(props: IProps) {
  const { setNavigation } = props;

  const goToPreviewPage = () => {
    setNavigation((prevState) => {
      return {
        ...prevState,
        previewPage: true,
      };
    });
  };

  return (
    <Tooltip title="Scene Editor">
      <Button
        id="preview-icon"
        type="button"
        onClick={goToPreviewPage}
        sx={{ padding: '2px', minWidth: '25px' }}
      >
        <PreviewIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
      </Button>
    </Tooltip>
  );
}
