import * as React from 'react';
import { Pages, RecStatus, AppState, RendererVideo } from 'main/types';
import { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import SceneEditor from './SceneEditor';
import SettingsPage from './SettingsPage';
import CategoryPage from './CategoryPage';

interface IProps {
  recorderStatus: RecStatus;
  videoState: RendererVideo[];
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>;
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  playerHeight: MutableRefObject<number>;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
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
      />
    );
  };

  return (
    <>
      {page === Pages.Settings && renderSettingsPage()}
      {page === Pages.SceneEditor && renderSceneEditor()}
      {page === Pages.None && renderCategoryPage()}
    </>
  );
};

export default Layout;
