import { Box } from '@mui/material';
import React from 'react';
import { RecStatus } from 'main/types';
import RecorderPreview from './RecorderPreview';
import ChatOverlayControls from './ChatOverlayControls';
import VideoSourceControls from './VideoSourceControls';
import AudioSourceControls from './AudioSourceControls';
import VideoBaseControls from './VideoBaseControls';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import Separator from './components/Separator/Separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './components/Tabs/Tabs';

interface IProps {
  recorderStatus: RecStatus;
}

const CategoryHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-foreground-lighter font-bold">{children}</h2>
);

const SceneEditor: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus } = props;

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
      <Box sx={{ width: '100%', height: '50%' }}>
        <RecorderPreview />
      </Box>
      <Tabs defaultValue="source" className="w-full h-[50%] px-4">
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
              <VideoSourceControls />
            </div>
          </TabsContent>
          <TabsContent value="video">
            <div className="p-4">
              <VideoBaseControls recorderStatus={recorderStatus} />
            </div>
          </TabsContent>
          <TabsContent value="audio">
            <div className="p-4">
              <AudioSourceControls />
            </div>
          </TabsContent>
          <TabsContent value="overlay">
            <div className="p-4">
              <ChatOverlayControls />
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Box>
  );
};

export default SceneEditor;
