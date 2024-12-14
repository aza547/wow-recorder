import * as React from 'react';
import { configSchema, ConfigurationSchema } from 'main/configSchema';
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

  const getLangaugeSelect = () => {
    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label className="flex items-center">
          Language
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.language.description
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Select value={String(config.language)} onValueChange={setLanguage}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select encoder" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(Language).map(mapLanguageToSelectItem)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="flex flex-row flex-wrap gap-x-8">{getLangaugeSelect()}</div>
  );
};

export default WindowsSettings;
