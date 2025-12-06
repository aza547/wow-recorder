import * as React from 'react';
import { configSchema, ConfigurationSchema } from 'config/configSchema';
import { Info } from 'lucide-react';
import { Dispatch, SetStateAction } from 'react';
import { getLocalePhrase, Language } from 'localisation/translations';
import { AppState } from 'main/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/Select/Select';
import { setConfigValues } from './useSettings';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import Switch from './components/Switch/Switch';
import { Phrase } from 'localisation/phrases';

interface IProps {
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const WindowsSettings = (props: IProps) => {
  const { config, setConfig, appState, setAppState } = props;
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      language: config.language,
    });
  }, [config.language]);

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
      <div className="flex flex-col">
        <Label htmlFor="separateBufferPath">
          {getLocalePhrase(appState.language, label)}
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch(preference, changeFn)}
        </div>
      </div>
    );
  };

  const mapLanguageToSelectItem = (lang: string) => {
    return (
      <SelectItem key={lang} value={lang}>
        {lang}
      </SelectItem>
    );
  };

  const setLanguage = (value: Language) => {
    setAppState((prevState) => {
      return {
        ...prevState,
        language: value,
      };
    });

    setConfig((prevState) => {
      return {
        ...prevState,
        language: value,
      };
    });
  };

  const setHideEmptyCategories = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        hideEmptyCategories: checked,
      };
    });
  };

  const getLangaugeSelect = () => {
    return (
      <div className="flex flex-col y-2 gap-y-4">
        <div className="flex flex-col w-1/4 min-w-40 max-w-60">
          <Label className="flex items-center">
            {getLocalePhrase(appState.language, Phrase.LanguageLabel)}
            <Tooltip
              content={getLocalePhrase(
                appState.language,
                configSchema.language.description,
              )}
              side="right"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <Select value={String(config.language)} onValueChange={setLanguage}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={getLocalePhrase(appState.language, Phrase.SelectLanguage)} />
            </SelectTrigger>
            <SelectContent>
              {Object.values(Language).map(mapLanguageToSelectItem)}
            </SelectContent>
          </Select>
        </div>
        {getSwitchForm(
          'hideEmptyCategories',
          Phrase.HideEmptyCategoriesLabel,
          setHideEmptyCategories,
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-row flex-wrap gap-x-8">{getLangaugeSelect()}</div>
  );
};

export default WindowsSettings;
