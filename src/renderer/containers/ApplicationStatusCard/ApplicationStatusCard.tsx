import {
  AppState,
  Crashes,
  MicStatus,
  RecStatus,
  SaveStatus,
} from 'main/types';
import { cn } from 'renderer/components/utils';
import { ConfigurationSchema } from 'main/configSchema';
import MicrophoneStatus from './MicStatus';
import Status from './Status';
import CrashStatus from './CrashStatus';

type ApplicationStatusCardProps = {
  recorderStatus: RecStatus;
  error: string;
  micStatus: MicStatus;
  crashes: Crashes;
  savingStatus: SaveStatus;
  config: ConfigurationSchema;
  appState: AppState;
};

const ApplicationStatusCard = ({
  recorderStatus,
  error,
  micStatus,
  crashes,
  savingStatus,
  config,
  appState,
}: ApplicationStatusCardProps) => {
  const hasExtraBar = !!(micStatus || crashes?.length);
  return (
    <div className="w-full h-20 rounded-md mb-4 flex relative">
      <div
        id="status-card-inner"
        className={cn(
          'w-[calc(100%-5px)] h-full rounded-md border border-background-dark-gradient-from relative z-10 transition-all',
          { 'w-[calc(100%-30px)]': hasExtraBar }
        )}
      >
        <div
          id="logo-layer"
          className="w-full h-full rounded-md bg-background-dark-gradient-to bg-[url('../../assets/icon/large-icon.png')] bg-contain bg-no-repeat absolute bg-[calc(100%+20px)] opacity-65"
        />
        <div
          id="gradient-layer"
          className="w-full h-full rounded-md bg-gradient-to-r from-background-dark-gradient-from to-transparent absolute"
        />
        <Status
          status={recorderStatus}
          error={error}
          savingStatus={savingStatus}
          config={config}
          appState={appState}
        />
      </div>
      <div
        className={cn(
          'bg-background-higher h-full w-[40px] rounded-r-md absolute top-0 right-0 z-1 border border-background-dark-gradient-to transition-all'
        )}
      >
        <div
          className={cn(
            'w-[30px] h-full flex flex-col items-center justify-around absolute right-0 top-0 rounded-tr-md border-t border-transparent',
            { ' border-[rgba(255,255,255,10%)]': hasExtraBar }
          )}
        >
          <MicrophoneStatus micStatus={micStatus} appState={appState} />
          <CrashStatus crashes={crashes} appState={appState} />
        </div>
      </div>
    </div>
  );
};

export default ApplicationStatusCard;
