import { ConfigurationSchema } from 'config/configSchema';
import React from 'react';
import { AppState } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import { setConfigValues, useSettings } from './useSettings';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';
import { Phrase } from 'localisation/phrases';

interface IProps {
  appState: AppState;
}

const PVPSettings = (props: IProps) => {
  const { appState } = props;
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      recordTwoVTwo: config.recordTwoVTwo,
      recordThreeVThree: config.recordThreeVThree,
      recordFiveVFive: config.recordFiveVFive,
      recordSkirmish: config.recordSkirmish,
      recordSoloShuffle: config.recordSoloShuffle,
      recordBattlegrounds: config.recordBattlegrounds,
    });
  }, [
    config.recordBattlegrounds,
    config.recordFiveVFive,
    config.recordSkirmish,
    config.recordSoloShuffle,
    config.recordThreeVThree,
    config.recordTwoVTwo,
  ]);

  const getSwitch = (
    preference: keyof ConfigurationSchema,
    changeFn: (checked: boolean) => void,
  ) => (
    <Switch
      checked={Boolean(config[preference])}
      name={preference}
      onCheckedChange={changeFn}
    />
  );

  const getSwitchForm = (
    preference: keyof ConfigurationSchema,
    label: Phrase,
    changeFn: (checked: boolean) => void,
  ) => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor={preference} className="flex items-center">
          {getLocalePhrase(appState.language, label)}
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch(preference, changeFn)}
        </div>
      </div>
    );
  };

  const setRecord2v2 = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordTwoVTwo: checked,
      };
    });
  };

  const setRecord3v3 = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordThreeVThree: checked,
      };
    });
  };

  const setRecord5v5 = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordFiveVFive: checked,
      };
    });
  };

  const setRecordSkirmish = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordSkirmish: checked,
      };
    });
  };

  const setRecordSolo = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordSoloShuffle: checked,
      };
    });
  };

  const setRecordBgs = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordBattlegrounds: checked,
      };
    });
  };

  return (
    <div className="flex flex-row flex-wrap gap-x-4">
      {getSwitchForm('recordTwoVTwo', Phrase.Record2v2Label, setRecord2v2)}
      {getSwitchForm('recordThreeVThree', Phrase.Record3v3Label, setRecord3v3)}
      {getSwitchForm('recordFiveVFive', Phrase.Record5v5Label, setRecord5v5)}
      {getSwitchForm(
        'recordSkirmish',
        Phrase.RecordSkirmishLabel,
        setRecordSkirmish,
      )}
      {getSwitchForm(
        'recordSoloShuffle',
        Phrase.RecordSoloShuffleLabel,
        setRecordSolo,
      )}
      {getSwitchForm(
        'recordBattlegrounds',
        Phrase.RecordBattlegroundsLabel,
        setRecordBgs,
      )}
    </div>
  );
};

export default PVPSettings;
