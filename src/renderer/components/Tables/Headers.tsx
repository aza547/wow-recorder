import { Checkbox } from '@mui/material';
import { HeaderContext } from '@tanstack/react-table';
import {
  CalendarDays,
  Eye,
  Gamepad2,
  Hash,
  Hourglass,
  MapPinned,
  MessageSquare,
  Swords,
  Trophy,
} from 'lucide-react';
import { RendererVideo } from 'main/types';

export const EncounterHeader = () => (
  <span className="inline-flex gap-x-1">
    <Gamepad2 />
    Encounter
  </span>
);

export const ResultHeader = () => (
  <span className="inline-flex gap-x-1">
    <Trophy />
    Result
  </span>
);

export const PullHeader = () => (
  <span className="inline-flex gap-x-1">
    <Hash />
    Pull
  </span>
);

export const DifficultyHeader = () => (
  <span className="inline-flex gap-x-1">
    <Swords />
    Difficulty
  </span>
);

export const DurationHeader = () => (
  <span className="inline-flex gap-x-1">
    <Hourglass />
    Duration
  </span>
);

export const DateHeader = () => (
  <span className="inline-flex gap-x-1">
    <CalendarDays />
    Date
  </span>
);

export const ViewpointsHeader = () => (
  <span className="inline-flex gap-x-1">
    <Eye />
    Viewpoints
  </span>
);

export const MapHeader = () => (
  <span className="inline-flex gap-x-1">
    <MapPinned />
    Map
  </span>
);

export const LevelHeader = () => (
  <span className="inline-flex gap-x-1">
    <Swords />
    Difficulty
  </span>
);

export const TypeHeader = () => (
  <span className="inline-flex gap-x-1">
    <Gamepad2 />
    Type
  </span>
);

export const TagHeader = () => (
  <span className="inline-flex gap-x-1">
    <MessageSquare />
    Tag
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
