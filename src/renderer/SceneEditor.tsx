import { Box } from '@mui/material';
import React from 'react';
import { AppState, RecStatus } from 'main/types';
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

interface IProps {
  appState: AppState;
  recorderStatus: RecStatus;
}

const SceneEditor: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, appState } = props;

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
        <RecorderPreview />
      </Box>
      <Tabs defaultValue="source" className="w-full h-[40%] px-4">
        <TabsList>
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="video">Video</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="overlay">Overlay</TabsTrigger>
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
