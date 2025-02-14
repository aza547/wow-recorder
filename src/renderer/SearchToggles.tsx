import { useEffect, useRef } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import { Phrase } from 'localisation/types';
import { setConfigValues } from './useSettings';
import {
  ToggleGroup,
  ToggleGroupItem,
} from './components/ToggleGroup/ToggleGroup';
import Label from './components/Label/Label';

interface IProps {
  config: ConfigurationSchema;
  setConfig: React.Dispatch<React.SetStateAction<ConfigurationSchema>>;
}

const SearchToggles = (props: IProps) => {
  const initialRender = useRef(true);
  const { config, setConfig } = props;

  useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      searchGrouping: config.searchGrouping,
    });
  }, [config.searchGrouping]);

  const setSearchGrouping = (value: string) => {
    const isTrue = value === 'true';
    setConfig((prevState) => {
      return {
        ...prevState,
        searchGrouping: isTrue,
      };
    });
  };

  const renderSearchGrouping = () => {
    return (
      <div>
        <Label>Search Grouping</Label>
        <ToggleGroup
          type="single"
          value={config.searchGrouping.toString()}
          size="sm"
          variant="outline"
          onValueChange={setSearchGrouping}
        >
          <ToggleGroupItem value="false">Individual</ToggleGroupItem>
          <ToggleGroupItem value="true">Grouped</ToggleGroupItem>
        </ToggleGroup>
      </div>
    );
  };
  return (
    <div className="flex items-center gap-x-5">{renderSearchGrouping()}</div>
  );
};

export default SearchToggles;
