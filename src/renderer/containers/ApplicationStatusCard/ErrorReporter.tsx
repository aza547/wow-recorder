import { Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { ShieldAlert } from 'lucide-react';
import { AppState, ErrorReport } from 'main/types';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from 'renderer/components/HoverCard/HoverCard';

const ErrorReporter = ({
  errorReports,
  appState,
}: {
  errorReports: ErrorReport[];
  appState: AppState;
}) => {
  if (!errorReports?.length) return null;
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
            {errorReports.map((report: ErrorReport) => {
              const dateString = report.date.toLocaleString();
              return (
                <li key={report.date.toISOString()}>
                  <span className="font-bold">{dateString}:</span>{' '}
                  <code>{report.reason}</code>
                </li>
              );
            })}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default ErrorReporter;
