import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { Tooltip } from '../Tooltip/Tooltip';

const SelectAllShortcut = ({ language }: { language: Language }) => {
  return (
    <div className="flex gap-1 items-center text-foreground-lighter text-sm">
      <Tooltip content={getLocalePhrase(language, Phrase.SelectAll)}>
        <div className="inline-flex whitespace-nowrap items-center border border-card rounded-sm p-1 bg-card">
          Ctrl + A
        </div>
      </Tooltip>
    </div>
  );
};

export default SelectAllShortcut;
