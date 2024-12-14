import { getLocalePhrase, Phrase } from 'localisation/translations';
import { ShieldAlert } from 'lucide-react';
import { Crashes, CrashData, AppState } from 'main/types';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from 'renderer/components/HoverCard/HoverCard';

const CrashStatus = ({
  crashes,
  appState,
}: {
  crashes: Crashes;
  appState: AppState;
}) => {
  if (!crashes?.length) return null;
  return (
    <HoverCard>
      <HoverCardTrigger>
        <ShieldAlert size={20} className="text-destructive" />
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex flex-col gap-y-2">
          <p className="text-xs text-popover-foreground/75">
            {getLocalePhrase(appState.language, Phrase.CrashHappenedText)}
          </p>
          <ul className="text-xs text-popover-foreground/60 list-disc pl-4">
            {crashes.map((crash: CrashData) => {
              const dateString = crash.date.toLocaleString();
              return (
                <li>
                  <span className="font-bold">{dateString}:</span>{' '}
                  <code>{crash.reason}</code>
                </li>
              );
            })}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default CrashStatus;
