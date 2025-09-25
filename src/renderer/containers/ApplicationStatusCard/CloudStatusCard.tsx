import { AppState } from 'main/types';

import CloudStatus from './CloudStatus';

type CloudStatusCardProps = {
  appState: AppState;
};

const CloudStatusCard = ({ appState }: CloudStatusCardProps) => {
  return (
    <div className="w-full h-14 rounded-md mb-4 flex relative">
      <div
        id="status-card-inner"
        className={
          'w-[calc(100%-5px)] h-full rounded-md border border-background-dark-gradient-from relative transition-all'
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
    </div>
  );
};

export default CloudStatusCard;
