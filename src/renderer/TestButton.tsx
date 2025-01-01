import React from 'react';
import { VideoCategory } from 'types/VideoCategory';
import { AppState, RecStatus } from 'main/types';
import { FlaskConical } from 'lucide-react';
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

const ipc = window.electron.ipcRenderer;

interface IProps {
  recorderStatus: RecStatus;
  appState: AppState;
}

const TestButton: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, appState } = props;

  const testCategories = [
    VideoCategory.TwoVTwo,
    VideoCategory.ThreeVThree,
    VideoCategory.SoloShuffle,
    VideoCategory.Raids,
    VideoCategory.Battlegrounds,
    VideoCategory.MythicPlus,
  ];

  const runTest = (
    event: React.MouseEvent<HTMLButtonElement>,
    category: VideoCategory,
  ) => {
    // 'Click' will perform a normal test
    // 'Ctrl-Alt-Click' will initiate a test but won't finish it
    // and requires a force stop of the recording.
    const endTest = !(event.ctrlKey && event.altKey);
    ipc.sendMessage('test', [category, endTest]);
  };

  const getPopover = () => {
    const ready = recorderStatus === RecStatus.ReadyToRecord;

    if (ready) {
      return (
        <div className="flex flex-col gap-y-2">
          <h2 className="text-sm font-semibold">
            {getLocalePhrase(appState.language, Phrase.TestButtonHeading)}
          </h2>
          <Separator className="my-1" />
          {testCategories.map((category: VideoCategory) => {
            return (
              <Button
                key={`test-button-${category}`}
                variant="ghost"
                onClick={(e) => {
                  runTest(e, category);
                }}
              >
                {getLocaleCategoryLabel(appState.language, category)}
              </Button>
            );
          })}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-y-2">
        <p className="text-xs text-popover-foreground/60">
          {getLocalePhrase(appState.language, Phrase.TestButtonUnable)}
        </p>
      </div>
    );
  };

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger>
        <Button variant="ghost" size="icon">
          <FlaskConical size={20} />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent>{getPopover()}</HoverCardContent>
    </HoverCard>
  );
};

export default TestButton;
