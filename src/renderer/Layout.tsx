import * as React from 'react';
import {
  AdvancedLoggingStatus,
  Pages,
  RecStatus,
  AppState,
  RendererVideo,
  InstantReplayState,
  ActivityStatus,
} from 'main/types';
import { Dispatch, RefObject, SetStateAction } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import SceneEditor from './SceneEditor';
import SettingsPage from './SettingsPage';
import CategoryPage from './CategoryPage';
import InstantReplay from './InstantReplay';

interface IProps {
  recorderStatus: RecStatus;
  videoState: RendererVideo[];
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>;
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  persistentProgress: RefObject<number>;
  playerHeight: RefObject<number>;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
  advancedLoggingStatus: AdvancedLoggingStatus;
  previewEnabled: boolean;
  setPreviewEnabled: Dispatch<SetStateAction<boolean>>;
  instantReplayState: InstantReplayState;
  setInstantReplayState: Dispatch<SetStateAction<InstantReplayState>>;
}

/**
 * The main window, minus the top and bottom bars.
 */
const Layout = (props: IProps) => {
  const {
    recorderStatus,
    videoState,
    setVideoState,
    appState,
    setAppState,
    persistentProgress,
    playerHeight,
    config,
    setConfig,
    advancedLoggingStatus,
    previewEnabled,
    setPreviewEnabled,
    instantReplayState,
    setInstantReplayState,
  } = props;
  const { page, category } = appState;

  const renderCategoryPage = () => {
    return (
      <CategoryPage
        category={category}
        videoState={videoState}
        setVideoState={setVideoState}
        appState={appState}
        setAppState={setAppState}
        persistentProgress={persistentProgress}
        playerHeight={playerHeight}
      />
    );
  };

  const renderSettingsPage = () => {
    return (
      <SettingsPage
        recorderStatus={recorderStatus}
        config={config}
        setConfig={setConfig}
        appState={appState}
        setAppState={setAppState}
        advancedLoggingStatus={advancedLoggingStatus}
        videoState={videoState}
      />
    );
  };

  const renderSceneEditor = () => {
    return (
      <SceneEditor
        recorderStatus={recorderStatus}
        appState={appState}
        config={config}
        setConfig={setConfig}
        previewEnabled={previewEnabled}
        setPreviewEnabled={setPreviewEnabled}
      />
    );
  };

  const renderInstantReplay = () => {
    return (
      <InstantReplay
        instantReplayState={instantReplayState}
        setInstantReplayState={setInstantReplayState}
        appState={appState}
        setAppState={setAppState}
        persistentProgress={persistentProgress}
        config={config}
      />
    );
  };

  return (
    <>
      {page === Pages.Settings && renderSettingsPage()}
      {page === Pages.SceneEditor && renderSceneEditor()}
      {page === Pages.InstantReplay && renderInstantReplay()}
      {page === Pages.None && renderCategoryPage()}
    </>
  );
};

export default Layout;
