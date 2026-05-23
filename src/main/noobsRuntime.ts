import { setNoobsPathEnvironment } from './noobsRuntimePath';

setNoobsPathEnvironment(process.env);

const noobs = require('noobs') as typeof import('noobs');

export type {
  ObsData,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from 'noobs';

export default noobs;
