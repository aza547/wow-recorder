import { IconButton, Tooltip } from '@mui/material';
import React from 'react';
import { RecStatus } from 'main/types';
import { configSchema } from 'main/configSchema';
import InfoIcon from '@mui/icons-material/Info';
import GeneralSettings from './GeneralSettings';
import WindowsSettings from './WindowsSettings';
import FlavourSettings from './FlavourSettings';
import PVESettings from './PVESettings';
import PVPSettings from './PVPSettings';
import CloudSettings from './CloudSettings';
import {
  Tabs,
  TabsList,
  TabsContent,
  TabsTrigger,
} from './components/Tabs/Tabs';
import Separator from './components/Separator/Separator';

interface IProps {
  recorderStatus: RecStatus;
}

const CategoryHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-foreground-lighter font-bold">{children}</h2>
);

const getCloudSettingsInfoIcon = () => {
  const helptext = [
    /* eslint-disable prettier/prettier */
    ['Cloud Playback', configSchema.cloudStorage.description].join('\n'),
    ['Cloud Upload', configSchema.cloudUpload.description].join('\n'),
    ['Upload Rate Limit', configSchema.cloudUploadRateLimit.description].join(
      '\n'
    ),
    ['Account Name', configSchema.cloudAccountName.description].join('\n'),
    ['Account Password', configSchema.cloudAccountPassword.description].join(
      '\n'
    ),
    ['Guild Name', configSchema.cloudGuildName.description].join('\n'),
    [
      'Upload Toggles',
      'Provides control over what content types get automatically uploaded.',
    ].join('\n'),
    /* eslint-enable prettier/prettier */
  ].join('\n\n');

  return (
    <Tooltip title={<div style={{ whiteSpace: 'pre-line' }}>{helptext}</div>}>
      <IconButton>
        <InfoIcon style={{ color: 'white' }} />
      </IconButton>
    </Tooltip>
  );
};

const SettingsPage: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus } = props;

  return (
    <div className="w-full h-full bg-background-higher pt-[32px] px-4">
      <Tabs defaultValue="application" className="w-full">
        <TabsList>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="game">Game</TabsTrigger>
          <TabsTrigger value="pro">Pro</TabsTrigger>
        </TabsList>
        <TabsContent value="application">
          <div className="p-4 flex flex-col gap-y-8">
            <div>
              <CategoryHeading>General Settings</CategoryHeading>
              <Separator className="mt-2 mb-4" />
              <GeneralSettings recorderStatus={recorderStatus} />
            </div>
            <div>
              <CategoryHeading>Windows Settings</CategoryHeading>
              <Separator className="mt-2 mb-4" />
              <WindowsSettings />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="game">
          <div className="p-4 flex flex-col gap-y-8">
            <div>
              <CategoryHeading>Game Settings</CategoryHeading>
              <Separator className="mt-2 mb-4" />
              <FlavourSettings recorderStatus={recorderStatus} />
            </div>
            <div>
              <CategoryHeading>PvE Settings</CategoryHeading>
              <Separator className="mt-2 mb-4" />
              <PVESettings />
            </div>
            <div>
              <CategoryHeading>PvP Settings</CategoryHeading>
              <Separator className="mt-2 mb-4" />
              <PVPSettings />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="pro">
          <div className="p-4 flex flex-col gap-y-8">
            <div>
              <CategoryHeading>Cloud Settings</CategoryHeading>
              <Separator className="mt-2 mb-4" />
              <CloudSettings recorderStatus={recorderStatus} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
