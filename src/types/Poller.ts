import { FlavourConfig } from '../main/types';

export interface PollerImplementation {
  start(): void;
  reset(): void;
  reconfigureFlavour(flavourConfig: FlavourConfig): void;
  isWowRunning: boolean;
  pollInterval: NodeJS.Timer | undefined;
}
