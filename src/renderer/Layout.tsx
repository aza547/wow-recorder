import * as React from 'react';
import { Pages, RecStatus, AppState, RendererVideo } from 'main/types';
import { MutableRefObject, useMemo } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import SceneEditor from './SceneEditor';
import SettingsPage from './SettingsPage';
import CategoryPage from './CategoryPage';
import StateManager from './StateManager';
import { getVideoCategoryFilter } from './rendererutils';
import { Table } from '@tanstack/react-table';

interface IProps {
  recorderStatus: RecStatus;
  stateManager: MutableRefObject<StateManager>;
  videoState: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  playerHeight: MutableRefObject<number>;
  config: ConfigurationSchema;
  setConfig: React.Dispatch<React.SetStateAction<ConfigurationSchema>>;
  table: Table<RendererVideo>;
}

/**
 * The main window, minus the top and bottom bars.
 */
const Layout = (props: IProps) => {
  const {
    recorderStatus,
    stateManager,
    videoState,
    appState,
    setAppState,
    persistentProgress,
    playerHeight,
    config,
    setConfig,
    table,
  } = props;
  const { page, category } = appState;

  const categoryState = useMemo<RendererVideo[]>(() => {
    const categoryFilter = getVideoCategoryFilter(category);
    return videoState.filter(categoryFilter);
  }, [videoState, category]);

  const renderCategoryPage = () => {
    return (
      <CategoryPage
        category={category}
        categoryState={categoryState}
        stateManager={stateManager}
        appState={appState}
        setAppState={setAppState}
        persistentProgress={persistentProgress}
        playerHeight={playerHeight}
        table={table}
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
    return <SceneEditor recorderStatus={recorderStatus} appState={appState} />;
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
