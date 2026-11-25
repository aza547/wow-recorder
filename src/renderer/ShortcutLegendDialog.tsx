import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/Dialog/Dialog';
import { Button } from './components/Button/Button';
import { cn } from './components/utils';

interface IProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
}

type Shortcut = {
  // Alternative key combinations that do the same thing.
  keys: string[];
  description: Phrase;
};

// The video player hotkeys. Keep in sync with handleKeyDown in VideoPlayer.
const basicShortcuts: Shortcut[] = [
  { keys: ['Space', 'K'], description: Phrase.ShortcutPlayPause },
  { keys: ['←', 'J'], description: Phrase.ShortcutSeekBackward },
  { keys: ['→', 'L'], description: Phrase.ShortcutSeekForward },
  { keys: ['M'], description: Phrase.ShortcutMute },
  { keys: ['F'], description: Phrase.ShortcutFullscreen },
  { keys: ['<'], description: Phrase.ShortcutSlowDown },
  { keys: ['>'], description: Phrase.ShortcutSpeedUp },
  { keys: ['Home'], description: Phrase.ShortcutJumpToStart },
  { keys: ['End'], description: Phrase.ShortcutJumpToEnd },
];

const advancedShortcuts: Shortcut[] = [
  { keys: [','], description: Phrase.ShortcutFrameBackward },
  { keys: ['.'], description: Phrase.ShortcutFrameForward },
  { keys: ['Alt + X'], description: Phrase.ShortcutClip },
  { keys: ['Alt + D'], description: Phrase.ShortcutDraw },
  { keys: ['Alt + A'], description: Phrase.ShortcutOpenLocation },
  { keys: ['Alt + S'], description: Phrase.ShortcutShareLink },
  { keys: ['?'], description: Phrase.ShortcutShowShortcuts },
];

const KeyChip = ({ label }: { label: string }) => (
  <div className="inline-flex whitespace-nowrap items-center justify-center min-w-[28px] border border-card rounded-sm p-1 bg-card">
    {label}
  </div>
);

export default function ShortcutLegendDialog(props: IProps) {
  const { open, onOpenChange, language } = props;

  const renderRow = (shortcut: Shortcut, idx: number) => (
    <div
      key={shortcut.description}
      className={cn(
        'flex items-center justify-between gap-4 h-10 px-3',
        'text-foreground-lighter text-sm cursor-default',
        idx % 2 === 0 ? 'bg-secondary/15' : 'bg-secondary/50',
      )}
    >
      <span>{getLocalePhrase(language, shortcut.description)}</span>
      <div className="flex items-center gap-1.5">
        {shortcut.keys.map((k) => (
          <KeyChip key={k} label={k} />
        ))}
      </div>
    </div>
  );

  const renderColumn = (heading: Phrase, shortcuts: Shortcut[]) => (
    <div className="flex flex-col flex-1 min-w-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground px-3 pb-2">
        {getLocalePhrase(language, heading)}
      </h3>
      <div className="flex flex-col rounded-md overflow-hidden border border-white/5">
        {shortcuts.map(renderRow)}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(language, Phrase.KeyboardShortcuts)}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-6 mt-2">
          {renderColumn(Phrase.ShortcutsBasic, basicShortcuts)}
          {renderColumn(Phrase.ShortcutsAdvanced, advancedShortcuts)}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">
              {getLocalePhrase(language, Phrase.Close)}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
