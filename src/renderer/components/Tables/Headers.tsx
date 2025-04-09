import { Checkbox } from '@mui/material';
import { HeaderContext } from '@tanstack/react-table';
import { getLocalePhrase } from 'localisation/translations';
import { Language, Phrase } from 'localisation/types';
import {
  CalendarDays,
  Eye,
  Joystick,
  Gamepad2,
  Hash,
  Hourglass,
  MapPinned,
  Swords,
  Trophy,
} from 'lucide-react';
import { RendererVideo } from 'main/types';

export const EncounterHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <Gamepad2 />
    {getLocalePhrase(language, Phrase.TableHeaderEncounter)}
  </span>
);

export const ResultHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <Trophy />
    {getLocalePhrase(language, Phrase.TableHeaderResult)}
  </span>
);

export const PullHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <Hash />
    {getLocalePhrase(language, Phrase.TableHeaderPull)}
  </span>
);

export const DifficultyHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <Swords />
    {getLocalePhrase(language, Phrase.TableHeaderDifficulty)}
  </span>
);

export const DurationHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <Hourglass />
    {getLocalePhrase(language, Phrase.TableHeaderDuration)}
  </span>
);

export const DateHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <CalendarDays />
    {getLocalePhrase(language, Phrase.TableHeaderDate)}
  </span>
);

export const ViewpointsHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <Eye />
    {getLocalePhrase(language, Phrase.TableHeaderViewpoints)}
  </span>
);

export const MapHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <MapPinned />
    {getLocalePhrase(language, Phrase.TableHeaderMap)}
  </span>
);

export const LevelHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <Swords />
    {getLocalePhrase(language, Phrase.TableHeaderDifficulty)}
  </span>
);

export const TypeHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <Joystick />
    {getLocalePhrase(language, Phrase.TableHeaderType)}
  </span>
);

export const ActivityHeader = (language: Language) => (
  <span className="inline-flex gap-x-1">
    <Gamepad2 />
    {getLocalePhrase(language, Phrase.Activity)}
  </span>
);

export const SelectHeader = (ctx: HeaderContext<RendererVideo, unknown>) => {
  const { table } = ctx;

  return (
    <Checkbox
      checked={table.getIsAllRowsSelected()}
      onClick={table.getToggleAllRowsSelectedHandler()}
      sx={{
        color: 'gray',
        '&.Mui-checked': {
          color: 'gray',
        },
        '&:hover': {
          backgroundColor: 'rgba(128, 128, 128, 0.05)',
        },
      }}
    />
  );
};

export const DetailsHeader = (language: Language) => (
  <span className="inline-flex gap-x-1"></span>
);
