import {
  AppState,
  Crashes,
  MicStatus,
  RecStatus,
  SaveStatus,
} from 'main/types';
import { cn } from 'renderer/components/utils';
import { ConfigurationSchema } from 'config/configSchema';
import CloudStatus from './CloudStatus';
import { Loader } from 'lucide-react';
import { Tooltip } from 'renderer/components/Tooltip/Tooltip';

type CloudStatusCardProps = {
  recorderStatus: RecStatus;
  error: string;
  micStatus: MicStatus;
  crashes: Crashes;
  savingStatus: SaveStatus;
  config: ConfigurationSchema;
  appState: AppState;
};

const CloudStatusCard = ({ appState }: CloudStatusCardProps) => {
  return (
    <div className="w-full h-14 rounded-md mb-4 flex relative">
      <div
        id="status-card-inner"
        className={
          'w-[calc(100%-30px)] h-full rounded-md border border-background-dark-gradient-from relative z-10 transition-all'
        }
      >
        <div
          id="logo-layer"
          className="w-full h-full rounded-md bg-background-dark-gradient-to bg-[url('../../assets/icon/wifi.png')] bg-contain bg-no-repeat absolute bg-[calc(100%+20px)] opacity-65"
        />
        <div
          id="gradient-layer"
          className="w-full h-full rounded-md bg-gradient-to-r from-background-dark-gradient-from to-transparent absolute"
        />
        <CloudStatus appState={appState} />
      </div>
      <div
        className={cn(
          'bg-background-higher h-full w-[40px] rounded-r-md absolute top-0 right-0 z-1 border border-background-dark-gradient-to transition-all',
        )}
      >
        <div
          className={
            'w-[30px] h-full flex flex-col items-center justify-around absolute right-0 top-0 rounded-tr-md border-t border-[rgba(255,255,255,10%)]'
          }
        >
          <Tooltip content={'Cloud stuff'} side="right">
            <Loader
              size={20}
              className="animate-spin"
              style={{ animation: 'spin 5s linear infinite' }}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default CloudStatusCard;
