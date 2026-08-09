import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { MousePointer } from 'lucide-react';

const SelectRangeShortcut = ({ language }: { language: Language }) => {
  return (
    <div className="flex gap-1 items-center text-foreground-lighter text-sm">
      <div className="inline-flex whitespace-nowrap items-center border border-card rounded-sm p-1 bg-card">
        Shift + <MousePointer size={16} />
      </div>
      <div className="text-foreground">
        {getLocalePhrase(language, Phrase.SelectRange)}
      </div>
    </div>
  );
};

export default SelectRangeShortcut;
