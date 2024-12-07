import React, { Dispatch, SetStateAction } from 'react';
import { RecStatus } from 'main/types';
import { ConfigurationSchema } from 'main/configSchema';
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
import { ScrollArea } from './components/ScrollArea/ScrollArea';

interface IProps {
  recorderStatus: RecStatus;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

const CategoryHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-foreground-lighter font-bold">{children}</h2>
);

const SettingsPage: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, config, setConfig } = props;

  return (
    <div className="w-full h-full bg-background-higher pt-[32px] px-4">
      <Tabs defaultValue="application" className="w-full">
        <TabsList>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="game">Game</TabsTrigger>
          <TabsTrigger value="pro">Pro</TabsTrigger>
        </TabsList>
        <ScrollArea
          withScrollIndicators={false}
          className="h-[calc(100svh-48px)] pb-8"
        >
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
                <FlavourSettings
                  recorderStatus={recorderStatus}
                  config={config}
                  setConfig={setConfig}
                />
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
        </ScrollArea>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
