import { Button, Tooltip } from '@mui/material';
import PreviewIcon from '@mui/icons-material/Preview';
import { Pages, TNavigatorState } from 'main/types';

interface IProps {
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

export default function SceneEditorButton(props: IProps) {
  const { setNavigation } = props;

  const goToSceneEditor = () => {
    setNavigation((prevState) => {
      return {
        ...prevState,
        page: Pages.SceneEditor,
      };
    });
  };

  return (
    <Tooltip title="Scene Editor">
      <Button
        id="preview-icon"
        type="button"
        onClick={goToSceneEditor}
        sx={{ padding: '2px', minWidth: '25px' }}
      >
        <PreviewIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
      </Button>
    </Tooltip>
  );
}
