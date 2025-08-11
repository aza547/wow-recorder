import { Box } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { AppState, RecStatus } from 'main/types';
import { Phrase } from 'localisation/types';
import { getLocalePhrase } from 'localisation/translations';
import RecorderPreview from './RecorderPreview';
import ChatOverlayControls from './ChatOverlayControls';
import VideoSourceControls from './VideoSourceControls';
import AudioSourceControls from './AudioSourceControls';
import VideoBaseControls from './VideoBaseControls';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './components/Tabs/Tabs';
import { Button } from './components/Button/Button';
import Switch from './components/Switch/Switch';
import { Tooltip } from './components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
  recorderStatus: RecStatus;
}

type BoxDimensions = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const SceneEditor: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, appState } = props;
  const [previewEnabled, setPreviewEnabled] = React.useState(true);

  // Kindof hate all this stuff living here and not in RecorderPreview (also might have a perf hit?)
  // But for now it's needed to enable the reset buttons. Must be a better way though. TODO.
  const [overlayBoxDimensions, setOverlayDimensions] = useState<BoxDimensions>({
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  });

  const [gameBoxDimensions, setGameBoxDimensions] = useState<BoxDimensions>({
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
  });

  // TODO: Ditto: surely this can live in the RecorderPreview.
  const initDraggableBoxes = async () => {
    const s = await ipc.getSourcePosition('WCR Overlay');
    setOverlayDimensions(s);
    const g = await ipc.getSourcePosition('WCR Window Capture');
    setGameBoxDimensions(g);
  };

  // TODO: Ditto again.
  useEffect(() => {
    // On component mount, get the source dimensions from the backend
    // to initialize the draggable boxes.
    initDraggableBoxes();
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        borderBottomLeftRadius: '6px',
      }}
      className="bg-background-higher pt-[32px]"
    >
      <Box sx={{ width: '100%', height: '60%' }}>
        <RecorderPreview
          previewEnabled={previewEnabled}
          gameBoxDimensions={gameBoxDimensions}
          setGameBoxDimensions={setGameBoxDimensions}
          overlayBoxDimensions={overlayBoxDimensions}
          setOverlayDimensions={setOverlayDimensions}
        />
      </Box>
      <Tabs defaultValue="source" className="w-full h-[40%] px-4">
        <TabsList>
          <TabsTrigger value="source">
            {getLocalePhrase(appState.language, Phrase.SourceHeading)}
          </TabsTrigger>
          <TabsTrigger value="video">
            {getLocalePhrase(appState.language, Phrase.VideoHeading)}
          </TabsTrigger>
          <TabsTrigger value="audio">
            {getLocalePhrase(appState.language, Phrase.AudioHeading)}
          </TabsTrigger>
          <TabsTrigger value="overlay">
            {getLocalePhrase(appState.language, Phrase.OverlayHeading)}
          </TabsTrigger>
          <div className="flex ml-auto items-center justify-center gap-x-2">
            <Button
              className="flex w-[60px]"
              variant="ghost"
              size="xs"
              onClick={() => {
                ipc.resetSourcePosition('WCR Window Capture');
                initDraggableBoxes();
              }}
            >
              <span className="text-xs text-foreground-lighter">
                Reset
                <br />
                Game
              </span>
            </Button>
            <Button
              className="flex w-[60px]"
              variant="ghost"
              size="xs"
              onClick={() => {
                ipc.resetSourcePosition('WCR Overlay');
                initDraggableBoxes();
              }}
            >
              <span className="text-xs text-foreground-lighter">
                Reset
                <br />
                Overlay
              </span>
            </Button>
            <Tooltip content="Preview On">
              <Box className="flex w-[60px] items-center justify-center">
                <Switch
                  checked={previewEnabled}
                  onCheckedChange={setPreviewEnabled}
                >
                  Hide
                </Switch>
              </Box>
            </Tooltip>
          </div>
        </TabsList>

        <ScrollArea
          withScrollIndicators={false}
          className="h-[calc(100%-48px)] pb-8"
        >
          <TabsContent value="source">
            <div className="p-4">
              <VideoSourceControls appState={appState} />
            </div>
          </TabsContent>
          <TabsContent value="video">
            <div className="p-4">
              <VideoBaseControls
                recorderStatus={recorderStatus}
                appState={appState}
              />
            </div>
          </TabsContent>
          <TabsContent value="audio">
            <div className="p-4">
              <AudioSourceControls appState={appState} />
            </div>
          </TabsContent>
          <TabsContent value="overlay">
            <div className="p-4">
              <ChatOverlayControls appState={appState} />
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Box>
  );
};

export default SceneEditor;
