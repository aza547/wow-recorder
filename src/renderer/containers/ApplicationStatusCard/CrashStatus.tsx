import { ShieldAlert } from 'lucide-react';
import { Crashes, CrashData } from 'main/types';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from 'renderer/components/HoverCard/HoverCard';

const CrashStatus = ({ crashes }: { crashes: Crashes }) => {
  if (!crashes?.length) return null;
  return (
    <HoverCard>
      <HoverCardTrigger>
        <ShieldAlert size={20} className="text-destructive" />
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex flex-col gap-y-2">
          <p className="text-xs text-popover-foreground/75">
            An OBS crash has occured and has been recovered from. This should
            not happen in normal operation. You may wish to seek help by sharing
            your WR and OBS logs in discord.
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
