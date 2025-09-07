import { Box } from '@mui/material';
import React, { Dispatch, useState } from 'react';
import { AppState, RecStatus, SceneItem } from 'main/types';
import { Phrase } from 'localisation/phrases';
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
import { ConfigurationSchema } from 'config/configSchema';

const ipc = window.electron.ipcRenderer;

interface IProps {
  appState: AppState;
  recorderStatus: RecStatus;
  config: ConfigurationSchema;
  setConfig: Dispatch<React.SetStateAction<ConfigurationSchema>>;
}

const SceneEditor: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, appState, config, setConfig } = props;
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const renderResetGameButton = () => {
    return (
      <Button
        className="flex w-[60px]"
        variant="ghost"
        size="xs"
        onClick={() => ipc.resetSourcePosition(SceneItem.GAME)}
      >
        <span className="text-xs text-foreground-lighter">
          Reset
          <br />
          Game
        </span>
      </Button>
    );
  };

  const renderResetOverlayButton = () => {
    return (
      <Button
        className="flex w-[60px]"
        variant="ghost"
        size="xs"
        onClick={() => ipc.resetSourcePosition(SceneItem.OVERLAY)}
      >
        <span className="text-xs text-foreground-lighter">
          Reset
          <br />
          Overlay
        </span>
      </Button>
    );
  };

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
          config={config}
          snapEnabled={snapEnabled}
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
          <div className="flex ml-auto items-center justify-center gap-x-4">
            {renderResetGameButton()}
            {config.chatOverlayEnabled && renderResetOverlayButton()}
            <Tooltip content="Toggle Snapping" side="bottom">
              <Box className="flex items-center justify-center ">
                <span className="text-xs text-card-foreground font-medium pr-2 text-center">
                  Source <br /> Snapping
                </span>
                <Switch
                  checked={snapEnabled}
                  onCheckedChange={setSnapEnabled}
                />
              </Box>
            </Tooltip>
            <Tooltip content="Toggle Preview" side="bottom">
              <Box className="flex items-center justify-center ">
                <span className="text-xs text-card-foreground font-medium pr-2 text-center">
                  Show <br /> Preview
                </span>
                <Switch
                  checked={previewEnabled}
                  onCheckedChange={setPreviewEnabled}
                />
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
                setPreviewEnabled={setPreviewEnabled}
              />
            </div>
          </TabsContent>
          <TabsContent value="audio">
            <div className="p-4">
              <AudioSourceControls
                appState={appState}
                setPreviewEnabled={setPreviewEnabled}
              />
            </div>
          </TabsContent>
          <TabsContent value="overlay">
            <div className="p-4">
              <ChatOverlayControls
                appState={appState}
                config={config}
                setConfig={setConfig}
              />
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Box>
  );
};

export default SceneEditor;
