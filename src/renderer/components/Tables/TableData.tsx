import {
  ColumnDef,
  ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { RendererVideo, AppState } from 'main/types';
import { useEffect, useMemo, useState } from 'react';
import {
  getPullNumber,
  getInstanceDifficultyText,
  videoToDate,
  getDungeonName,
  getVideoCategoryFilter,
} from 'renderer/rendererutils';
import { VideoCategory } from 'types/VideoCategory';
import VideoFilter from 'renderer/VideoFilter';
import {
  populateSelectCell,
  populateEncounterNameCell,
  populateResultCell,
  populateDurationCell,
  populateDateCell,
  populateViewpointCell,
  populateDetailsCell,
  populateMapCell,
  populateLevelCell,
  populateTagCell,
} from './Cells';
import {
  SelectHeader,
  EncounterHeader,
  ResultHeader,
  PullHeader,
  DifficultyHeader,
  DurationHeader,
  DateHeader,
  ViewpointsHeader,
  MapHeader,
  LevelHeader,
  TypeHeader,
  TagHeader,
} from './Headers';
import {
  resultSort,
  durationSort,
  viewPointCountSort,
  levelSort,
} from './Sorting';

const useTable = (videoState: RendererVideo[], appState: AppState) => {
  const { category, language } = appState;

  /**
   * Tracks if the individual rows are expanded or not.
   */
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState({});

  /**
   * Reset expanded on changing category. Probably this could be
   * higher in the stack rather than running post-render of a new category.
   */
  useEffect(() => {
    setExpanded({});
    setRowSelection({});
  }, [category]);

  /**
   * The raid table columns, the data access, sorting functions
   * and any display transformations.
   */
  const raidColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Select',
        size: 50,
        header: SelectHeader,
        cell: populateSelectCell,
        enableSorting: false,
      },
      {
        id: 'Encounter',
        accessorKey: 'encounterName',
        header: () => EncounterHeader(language),
        cell: populateEncounterNameCell,
      },
      {
        id: 'Result',
        accessorFn: (v) => v,
        sortingFn: (a, b) => resultSort(a, b, language),
        header: () => ResultHeader(language),
        cell: (c) => populateResultCell(c, language),
      },
      {
        id: 'Pull',
        accessorFn: (v) => getPullNumber(v, videoState),
        header: () => PullHeader(language),
      },
      {
        id: 'Difficulty',
        accessorFn: (v) => getInstanceDifficultyText(v),
        header: () => DifficultyHeader(language),
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: populateViewpointCell,
        sortingFn: viewPointCountSort,
      },
      {
        id: 'Details',
        size: 50,
        cell: populateDetailsCell,
      },
    ],
    [language, videoState]
  );

  /**
   * The arena table columns, the data access, sorting functions
   * and any display transformations.
   */
  const arenaColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Select',
        size: 50,
        header: SelectHeader,
        cell: populateSelectCell,
        enableSorting: false,
      },
      {
        id: 'Map',
        accessorKey: 'zoneName',
        header: () => MapHeader(language),
        cell: populateMapCell,
      },
      {
        id: 'Result',
        accessorFn: (v) => v,
        sortingFn: (a, b) => resultSort(a, b, language),
        header: () => ResultHeader(language),
        cell: (c) => populateResultCell(c, language),
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: populateViewpointCell,
        sortingFn: viewPointCountSort,
      },
      {
        id: 'Details',
        size: 50,
        cell: populateDetailsCell,
      },
    ],
    [language]
  );

  /**
   * The dungeon table columns, the data access, sorting functions
   * and any display transformations.
   */
  const dungeonColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Select',
        size: 50,
        header: SelectHeader,
        cell: populateSelectCell,
        enableSorting: false,
      },
      {
        id: 'Map',
        accessorFn: getDungeonName,
        header: () => MapHeader(language),
        cell: populateMapCell,
      },
      {
        id: 'Result',
        accessorFn: (v) => v,
        sortingFn: (a, b) => resultSort(a, b, language),
        header: () => ResultHeader(language),
        cell: (c) => populateResultCell(c, language),
      },
      {
        id: 'Level',
        accessorFn: (v) => v,
        sortingFn: levelSort,
        header: () => LevelHeader(language),
        cell: populateLevelCell,
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: populateViewpointCell,
        sortingFn: viewPointCountSort,
      },
      {
        id: 'Details',
        size: 50,
        cell: populateDetailsCell,
      },
    ],
    [language]
  );

  /**
   * The battleground table columns, the data access, sorting functions
   * and any display transformations.
   */
  const battlegroundColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Select',
        size: 50,
        header: SelectHeader,
        cell: populateSelectCell,
        enableSorting: false,
      },
      {
        id: 'Map',
        accessorKey: 'zoneName',
        header: () => MapHeader(language),
        cell: populateMapCell,
      },
      {
        id: 'Result',
        accessorFn: (v) => v,
        sortingFn: (a, b) => resultSort(a, b, language),
        header: () => ResultHeader(language),
        cell: (c) => populateResultCell(c, language),
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: populateViewpointCell,
        sortingFn: viewPointCountSort,
      },
      {
        id: 'Details',
        size: 50,
        cell: populateDetailsCell,
      },
    ],
    [language]
  );

  /**
   * The battleground table columns, the data access, sorting functions
   * and any display transformations.
   */
  const clipsColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Select',
        size: 50,
        header: SelectHeader,
        cell: populateSelectCell,
        enableSorting: false,
      },
      {
        id: 'Type',
        accessorKey: 'parentCategory',
        header: () => TypeHeader(language),
        cell: (info) => info.getValue(),
      },
      {
        id: 'Tag',
        accessorFn: (v) => v.tag,
        header: () => TagHeader(language),
        cell: populateTagCell,
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: populateViewpointCell,
        sortingFn: viewPointCountSort,
      },
      {
        id: 'Details',
        size: 50,
        cell: populateDetailsCell,
      },
    ],
    [language]
  );

  let columns;

  switch (category) {
    case VideoCategory.Raids:
      columns = raidColumns;
      break;
    case VideoCategory.MythicPlus:
      columns = dungeonColumns;
      break;
    case VideoCategory.Battlegrounds:
      columns = battlegroundColumns;
      break;
    case VideoCategory.Clips:
      columns = clipsColumns;
      break;
    case VideoCategory.TwoVTwo:
    case VideoCategory.ThreeVThree:
    case VideoCategory.FiveVFive:
    case VideoCategory.Skirmish:
    case VideoCategory.SoloShuffle:
      columns = arenaColumns;
      break;
    default:
      throw new Error('Unrecognized category');
  }

  const { videoFilterQuery } = appState;

  const filteredState = useMemo<RendererVideo[]>(() => {
    const categoryFilter = getVideoCategoryFilter(category);
    const categoryState = videoState.filter(categoryFilter);

    const queryFilter = (v: RendererVideo) =>
      new VideoFilter(videoFilterQuery, v).filter();

    return categoryState.filter(queryFilter);
  }, [category, videoState, videoFilterQuery]);

  /**
   * Prepare the headless table, with sorting and row expansion. This is where
   * the data is passed in to be rendered.
   */
  const table = useReactTable({
    columns,
    data: filteredState,
    state: { expanded, rowSelection },
    getRowId: (row) => row.uniqueId,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowCanExpand: () => true,
    getExpandedRowModel: getExpandedRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
  });

  return table;
};

export default useTable;
