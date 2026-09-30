import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { ArrowDownUp } from 'lucide-react';
import { Tooltip } from '../Tooltip/Tooltip';

const NavigateShortcut = ({ language }: { language: Language }) => {
  return (
    <div className="flex gap-1 items-center text-foreground-lighter text-sm cursor-default">
      <Tooltip content={getLocalePhrase(language, Phrase.Navigate)}>
        <div className="inline-flex whitespace-nowrap items-center border border-card rounded-sm p-1 bg-card gap-1">
          {getLocalePhrase(language, Phrase.Arrows)}
          <ArrowDownUp size={16} />
        </div>
      </Tooltip>
    </div>
  );
};

export default NavigateShortcut;
