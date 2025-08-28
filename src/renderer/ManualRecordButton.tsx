import React from 'react';
import { VideoCategory } from 'types/VideoCategory';
import { AppState, RecStatus } from 'main/types';
import { FlaskConical, HardHat } from 'lucide-react';
import {
  getLocaleCategoryLabel,
  getLocalePhrase,
  Phrase,
} from 'localisation/translations';
import { Button } from './components/Button/Button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from './components/HoverCard/HoverCard';
import Separator from './components/Separator/Separator';
import { Tooltip } from './components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

interface IProps {
  recorderStatus: RecStatus;
  appState: AppState;
}

const ManualRecordButton: React.FC<IProps> = (props: IProps) => {
  return (
    <Tooltip content={'manual start stop'} side="top">
      <Button
        id="discord-button"
        type="button"
        onClick={() => {
          console.log('manual start/stop recording');
        }}
        variant="ghost"
        size="icon"
      >
        <HardHat size={20} />
      </Button>
    </Tooltip>
  );
};

export default ManualRecordButton;
