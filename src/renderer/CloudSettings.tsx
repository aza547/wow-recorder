import * as React from 'react';
import Box from '@mui/material/Box';
import {
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import { configSchema, ConfigurationSchema } from 'main/configSchema';
import { CloudStatus, RecStatus } from 'main/types';
import { useState } from 'react';
import CloudIcon from '@mui/icons-material/Cloud';
import { Cloud, CloudUpload, Info } from 'lucide-react';
import { setConfigValues, useSettings } from './useSettings';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Input } from './components/Input/Input';
import Progress from './components/Progress/Progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/Select/Select';
import Separator from './components/Separator/Separator';

const ipc = window.electron.ipcRenderer;

const raidDifficultyOptions = ['LFR', 'Normal', 'Heroic', 'Mythic'];

const formControlLabelStyle = { color: 'white', m: 2 };

const switchStyle = {
  '& .MuiSwitch-switchBase': {
    '&.Mui-checked': {
      color: '#fff',
      '+.MuiSwitch-track': {
        backgroundColor: '#bb4220',
        opacity: 1.0,
      },
    },
    '&.Mui-disabled + .MuiSwitch-track': {
      opacity: 0.5,
    },
  },
};

let debounceTimer: NodeJS.Timer | undefined;

interface IProps {
  recorderStatus: RecStatus;
}

const CloudSettings = (props: IProps) => {
  const { recorderStatus } = props;
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({
    usageGB: 0,
    maxUsageGB: 0,
  });

  React.useEffect(() => {
    if (initialRender.current) {
      // Drop out on initial render after getting the cloud status,
      // we don't need to set config. The first time we load.
      ipc.sendMessage('getCloudStatus', []);
      initialRender.current = false;
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      setConfigValues({
        cloudStorage: config.cloudStorage,
        cloudAccountName: config.cloudAccountName,
        cloudAccountPassword: config.cloudAccountPassword,
        cloudGuildName: config.cloudGuildName,
        cloudUpload: config.cloudUpload,
        cloudUploadRateLimit: config.cloudUploadRateLimit,
        cloudUploadRateLimitMbps: config.cloudUploadRateLimitMbps,
        cloudUpload2v2: config.cloudUpload2v2,
        cloudUpload3v3: config.cloudUpload3v3,
        cloudUpload5v5: config.cloudUpload5v5,
        cloudUploadSkirmish: config.cloudUploadSkirmish,
        cloudUploadSoloShuffle: config.cloudUploadSoloShuffle,
        cloudUploadDungeons: config.cloudUploadDungeons,
        cloudUploadRaids: config.cloudUploadRaids,
        cloudUploadBattlegrounds: config.cloudUploadBattlegrounds,
        cloudUploadRaidMinDifficulty: config.cloudUploadRaidMinDifficulty,
        cloudUploadDungeonMinLevel: config.cloudUploadDungeonMinLevel,
        chatOverlayOwnImage: config.chatOverlayOwnImage,
      });

      // Inform the backend of a settings change so we can update config
      // and validate it's good.
      ipc.sendMessage('settingsChange', []);
    }, 500);
  }, [
    config.cloudStorage,
    config.cloudAccountName,
    config.cloudAccountPassword,
    config.cloudGuildName,
    config.cloudUpload,
    config.cloudUploadRateLimit,
    config.cloudUploadRateLimitMbps,
    config.cloudUpload2v2,
    config.cloudUpload3v3,
    config.cloudUpload5v5,
    config.cloudUploadSkirmish,
    config.cloudUploadSoloShuffle,
    config.cloudUploadDungeons,
    config.cloudUploadRaids,
    config.cloudUploadBattlegrounds,
    config.cloudUploadRaidMinDifficulty,
    config.cloudUploadDungeonMinLevel,
    config.chatOverlayOwnImage,
  ]);

  React.useEffect(() => {
    ipc.on('updateCloudStatus', (status) => {
      setCloudStatus(status as CloudStatus);
    });
  }, []);

  const isComponentDisabled = () => {
    const isRecording = recorderStatus === RecStatus.Recording;
    const isOverrunning = recorderStatus === RecStatus.Overrunning;
    return isRecording || isOverrunning;
  };

  const getDisabledText = () => {
    if (!isComponentDisabled()) {
      return <></>;
    }

    return (
      <Typography
        variant="h6"
        sx={{
          color: 'white',
          fontSize: '0.75rem',
          fontFamily: '"Arial",sans-serif',
          fontStyle: 'italic',
          m: 1,
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        Some settings in this category are currently hidden as they can not be
        modified while a recording is active.
      </Typography>
    );
  };

  const getSwitch = (
    preference: keyof ConfigurationSchema,
    changeFn: (checked: boolean) => void
  ) => (
    <Switch
      checked={Boolean(config[preference])}
      name={preference}
      onCheckedChange={changeFn}
    />
  );

  const getSwitchForm = (
    preference: keyof ConfigurationSchema,
    label: string
  ) => {
    const changeFn = (checked: boolean) => {
      setConfig((prevState) => {
        return {
          ...prevState,
          [preference]: checked,
        };
      });
    };

    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor={preference} className="flex items-center">
          {label}
          <Tooltip content={configSchema[preference].description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch(preference, changeFn)}
        </div>
      </div>
    );
  };

  const formControlStyle = { width: '100%' };

  const style = {
    m: 1,
    width: '100%',
    color: 'white',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'white',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#bb4220',
    },
    '&.Mui-focused': {
      borderColor: '#bb4220',
      color: '#bb4220',
    },
    '&:hover': {
      '&& fieldset': {
        borderColor: '#bb4220',
      },
    },
    '& .MuiOutlinedInput-root': {
      '&.Mui-focused fieldset': {
        borderColor: '#bb4220',
      },
    },
    '.MuiSvgIcon-root ': {
      fill: 'white !important',
    },
  };

  const setMinRaidThreshold = (value: string) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadRaidMinDifficulty: value,
      };
    });
  };

  const getMinRaidDifficultySelect = () => {
    if (!config.cloudUploadRaids) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label
          htmlFor="cloudUploadRaidMinDifficulty"
          className="flex items-center"
        >
          Upload Difficulty Threshold
          <Tooltip
            content={configSchema.cloudUploadRaidMinDifficulty.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Select
          onValueChange={setMinRaidThreshold}
          disabled={!config.cloudUploadRaids}
          value={config.cloudUploadRaidMinDifficulty}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Placeholder" />
          </SelectTrigger>
          <SelectContent>
            {raidDifficultyOptions.map((difficulty: string) => (
              <SelectItem key={difficulty} value={difficulty}>
                {difficulty}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const setMinKeystoneLevel = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.value) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadDungeonMinLevel: parseInt(event.target.value, 10),
      };
    });
  };

  const getMinKeystoneLevelField = () => {
    if (!config.cloudUploadDungeons) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label
          htmlFor="cloudUploadDungeonMinLevel"
          className="flex items-center"
        >
          Upload Level Threshold
          <Tooltip
            content={configSchema.cloudUploadDungeonMinLevel.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          value={config.cloudUploadDungeonMinLevel}
          name="cloudUploadDungeonMinLevel"
          disabled={!config.cloudUploadDungeons}
          onChange={setMinKeystoneLevel}
          type="number"
          min={2}
        />
      </div>
    );
  };

  const setCloudStorage = (checked: boolean) => {
    setConfig((prevState) => {
      const cloudStorage = checked;

      const newState = {
        ...prevState,
        cloudStorage,
      };

      if (!cloudStorage) {
        // Can't have upload on if cloud storage is off so also set that
        // to false if we're disabling cloud storage.
        newState.cloudUpload = false;
      }

      return newState;
    });
  };

  const setCloudUpload = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUpload: checked,
      };
    });
  };

  const getCloudSwitch = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="cloudStorage" className="flex items-center">
          Cloud Playback
          <Tooltip content={configSchema.cloudStorage.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('cloudStorage', setCloudStorage)}
        </div>
      </div>
    );
  };

  const getCloudUploadSwitch = () => {
    if (isComponentDisabled() || !config.cloudStorage) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="cloudUpload" className="flex items-center">
          Cloud Upload
          <Tooltip content={configSchema.cloudUpload.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('cloudUpload', setCloudUpload)}
        </div>
      </div>
    );
  };

  const setCloudUploadRateLimit = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadRateLimit: checked,
      };
    });
  };

  const getCloudUploadRateLimitSwitch = () => {
    if (isComponentDisabled() || !config.cloudUpload) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="cloudUploadRateLimit" className="flex items-center">
          Upload Rate Limit
          <Tooltip
            content={configSchema.cloudUploadRateLimit.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('cloudUploadRateLimit', setCloudUploadRateLimit)}
        </div>
      </div>
    );
  };

  const setCloudAccountName = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudAccountName: event.target.value,
      };
    });
  };

  const getCloudAccountNameField = () => {
    if (isComponentDisabled() || !config.cloudStorage) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-60 max-w-80">
        <Label htmlFor="cloudAccountName" className="flex items-center">
          User / Email
          <Tooltip
            content={configSchema.cloudAccountName.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="cloudAccountName"
          value={config.cloudAccountName}
          onChange={setCloudAccountName}
          spellCheck={false}
          required
        />
        {config.cloudAccountName === '' && (
          <span className="text-error text-xs font-semibold mt-1">
            Cannot be empty
          </span>
        )}
      </div>
    );
  };

  const setCloudPassword = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudAccountPassword: event.target.value,
      };
    });
  };

  const getCloudAccountPasswordField = () => {
    if (isComponentDisabled() || !config.cloudStorage) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-60 max-w-80">
        <Label htmlFor="cloudAccountPassword" className="flex items-center">
          Password
          <Tooltip
            content={configSchema.cloudAccountPassword.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="cloudAccountPassword"
          value={config.cloudAccountPassword}
          onChange={setCloudPassword}
          spellCheck={false}
          type="password"
          required
        />
        {config.cloudAccountPassword === '' && (
          <span className="text-error text-xs font-semibold mt-1">
            Cannot be empty
          </span>
        )}
      </div>
    );
  };

  const setCloudGuild = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudGuildName: event.target.value,
      };
    });
  };

  const getCloudGuildField = () => {
    if (isComponentDisabled() || !config.cloudStorage) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-60 max-w-80">
        <Label htmlFor="cloudGuildName" className="flex items-center">
          Guild Name
          <Tooltip content={configSchema.cloudGuildName.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="cloudGuildName"
          value={config.cloudGuildName}
          onChange={setCloudGuild}
          spellCheck={false}
          required
        />
        {config.cloudGuildName === '' && (
          <span className="text-error text-xs font-semibold mt-1">
            Cannot be empty
          </span>
        )}
      </div>
    );
  };

  const getCloudUsageBar = () => {
    const usage = cloudStatus.usageGB;
    const max = cloudStatus.maxUsageGB;
    const perc = Math.round((100 * usage) / max);

    return (
      <div className="flex flex-row items-center justify-start w-1/3 min-w-80 max-w-120 gap-x-2">
        <Tooltip content="Cloud usage">
          <Cloud size={24} />
        </Tooltip>

        <Progress value={perc} className="h-3" />
        <span className="text-[11px] text-foreground font-semibold whitespace-nowrap">
          {Math.round(usage)}GB of {Math.round(max)}GB
        </span>
      </div>
    );
  };

  const getCloudUploadCategorySettings = () => {
    return (
      <>
        <div className="flex flex-row gap-x-6">
          {getSwitchForm('cloudUploadRaids', 'Upload Raids')}
          {getMinRaidDifficultySelect()}
        </div>

        <div className="flex flex-row gap-x-6">
          {getSwitchForm('cloudUploadDungeons', 'Upload Mythic+')}
          {getMinKeystoneLevelField()}
        </div>

        <div className="flex flex-row gap-x-6">
          {getSwitchForm('cloudUpload2v2', 'Upload 2v2')}
          {getSwitchForm('cloudUpload3v3', 'Upload 3v3')}
          {getSwitchForm('cloudUpload5v5', 'Upload 5v5')}
          {getSwitchForm('cloudUploadSkirmish', 'Upload Skirmish')}
          {getSwitchForm('cloudUploadSoloShuffle', 'Upload Solo Shuffle')}
          {getSwitchForm('cloudUploadBattlegrounds', 'Upload Battlegrounds')}
        </div>
      </>
    );
  };

  const setUploadRateLimit = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.value) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadRateLimitMbps: parseInt(event.target.value, 10),
      };
    });
  };

  const getRateLimitField = () => {
    if (!config.cloudUpload || !config.cloudUploadRateLimit) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-60 max-w-80">
        <Label htmlFor="cloudUploadRateLimitMbps" className="flex items-center">
          Upload Rate Limit (MB/s)
          <Tooltip
            content={configSchema.cloudUploadRateLimitMbps.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="cloudUploadRateLimitMbps"
          value={config.cloudUploadRateLimitMbps}
          onChange={setUploadRateLimit}
          spellCheck={false}
          type="number"
        />
        {config.cloudUploadRateLimitMbps < 1 && (
          <span className="text-error text-xs font-semibold mt-1">
            Must be 1 or greater
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-4">
      {getDisabledText()}

      <div className="flex flex-row">{getCloudSwitch()}</div>

      <div className="flex flex-row gap-4 flex-wrap">
        {getCloudAccountNameField()}
        {getCloudAccountPasswordField()}
        {getCloudGuildField()}
      </div>

      {config.cloudStorage && (
        <>
          {getCloudUsageBar()}
          <Separator className="my-4" />
        </>
      )}

      <div className="flex flex-col gap-4">
        <div>{getCloudUploadSwitch()}</div>
        <div className="flex flex-row gap-x-6">
          {getCloudUploadRateLimitSwitch()}
          {getRateLimitField()}
        </div>
        {config.cloudUpload && getCloudUploadCategorySettings()}
      </div>
    </div>
  );
};

export default CloudSettings;
