import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { MousePointer } from 'lucide-react';
import { Tooltip } from '../Tooltip/Tooltip';

const SelectMultiShortcut = ({ language }: { language: Language }) => {
  return (
    <div className="flex gap-1 items-center text-foreground-lighter text-sm cursor-default">
      <Tooltip content={getLocalePhrase(language, Phrase.SelectMultiple)}>
        <div className="inline-flex whitespace-nowrap items-center border border-card rounded-sm p-1 bg-card">
          Ctrl + <MousePointer size={16} />
        </div>
      </Tooltip>
    </div>
  );
};

export default SelectMultiShortcut;
