import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';

const SelectAllShortcut = ({ language }: { language: Language }) => {
  return (
    <div className="flex gap-1 items-center text-foreground-lighter text-sm">
      <div className="inline-flex whitespace-nowrap items-center border border-card rounded-sm p-1 bg-card">
        Ctrl + A
      </div>
      <div className="text-foreground">
        {getLocalePhrase(language, Phrase.SelectAll)}
      </div>
    </div>
  );
};

export default SelectAllShortcut;
