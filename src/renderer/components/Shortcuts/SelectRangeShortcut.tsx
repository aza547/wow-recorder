import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { MousePointer } from 'lucide-react';
import { Tooltip } from '../Tooltip/Tooltip';

const SelectRangeShortcut = ({ language }: { language: Language }) => {
  return (
    <div className="flex gap-1 items-center text-foreground-lighter text-sm">
      <Tooltip content={getLocalePhrase(language, Phrase.SelectRange)}>
        <div className="inline-flex whitespace-nowrap items-center border border-card rounded-sm p-1 bg-card">
          Shift + <MousePointer size={16} />
        </div>
      </Tooltip>
    </div>
  );
};

export default SelectRangeShortcut;
