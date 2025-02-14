import {
  ColumnDef,
  ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
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
  populateActivityCell,
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
  ActivityHeader,
  DetailsHeader,
} from './Headers';
import {
  resultSort,
  durationSort,
  viewPointCountSort,
  levelSort,
} from './Sorting';
import { getLocaleCategoryLabel } from 'localisation/translations';

const useTable = (videoState: RendererVideo[], appState: AppState) => {
  const { category, language } = appState;

  /**
   * Tracks if the individual rows are expanded or not.
   */
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState({});

  /**
   * Controls the table pagnation.
   */
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

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
        size: 100,
        accessorFn: (v) => v,
        sortingFn: (a, b) => resultSort(a, b, language),
        header: () => ResultHeader(language),
        cell: (c) => populateResultCell(c, language),
      },
      {
        id: 'Pull',
        size: 100,
        accessorFn: (v) => getPullNumber(v, videoState),
        header: () => PullHeader(language),
      },
      {
        id: 'Difficulty',
        size: 100,
        accessorFn: (v) => getInstanceDifficultyText(v, language),
        header: () => DifficultyHeader(language),
      },
      {
        id: 'Duration',
        size: 100,
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        size: 100,
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        size: 125,
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: populateViewpointCell,
        sortingFn: viewPointCountSort,
      },
      {
        id: 'Details',
        size: 75,
        accessorFn: (v) => v,
        header: () => DetailsHeader(language),
        cell: (ctx) => populateDetailsCell(ctx, language),
      },
    ],
    [language, videoState],
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
        size: 100,
        accessorFn: (v) => v,
        sortingFn: (a, b) => resultSort(a, b, language),
        header: () => ResultHeader(language),
        cell: (c) => populateResultCell(c, language),
      },
      {
        id: 'Duration',
        size: 100,
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        size: 100,
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        size: 125,
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: populateViewpointCell,
        sortingFn: viewPointCountSort,
      },
      {
        id: 'Details',
        size: 75,
        accessorFn: (v) => v,
        header: () => DetailsHeader(language),
        cell: (ctx) => populateDetailsCell(ctx, language),
      },
    ],
    [language],
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
        size: 100,
        accessorFn: (v) => v,
        sortingFn: (a, b) => resultSort(a, b, language),
        header: () => ResultHeader(language),
        cell: (c) => populateResultCell(c, language),
      },
      {
        id: 'Level',
        size: 100,
        accessorFn: (v) => v,
        sortingFn: levelSort,
        header: () => LevelHeader(language),
        cell: populateLevelCell,
      },
      {
        id: 'Duration',
        size: 100,
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        size: 100,
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        size: 125,
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: populateViewpointCell,
        sortingFn: viewPointCountSort,
      },
      {
        id: 'Details',
        size: 75,
        accessorFn: (v) => v,
        header: () => DetailsHeader(language),
        cell: (ctx) => populateDetailsCell(ctx, language),
      },
    ],
    [language],
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
        size: 100,
        accessorFn: (v) => v,
        sortingFn: (a, b) => resultSort(a, b, language),
        header: () => ResultHeader(language),
        cell: (c) => populateResultCell(c, language),
      },
      {
        id: 'Duration',
        size: 100,
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        size: 100,
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        size: 125,
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: populateViewpointCell,
        sortingFn: viewPointCountSort,
      },
      {
        id: 'Details',
        size: 75,
        accessorFn: (v) => v,
        header: () => DetailsHeader(language),
        cell: (ctx) => populateDetailsCell(ctx, language),
      },
    ],
    [language],
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
        size: 100,
        accessorKey: 'parentCategory',
        header: () => TypeHeader(language),
        cell: (info) => {
          const category = info.getValue();
          return getLocaleCategoryLabel(language, category as VideoCategory);
        },
      },
      {
        id: 'Activity',
        accessorFn: (v) => v,
        header: () => ActivityHeader(language),
        cell: (ctx) => populateActivityCell(ctx, language),
      },
      {
        id: 'Duration',
        size: 100,
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: () => DurationHeader(language),
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        size: 100,
        accessorFn: (v) => videoToDate(v),
        header: () => DateHeader(language),
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        size: 125,
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: populateViewpointCell,
        sortingFn: viewPointCountSort,
      },
      {
        id: 'Details',
        size: 75,
        accessorFn: (v) => v,
        header: () => DetailsHeader(language),
        cell: (ctx) => populateDetailsCell(ctx, language),
      },
    ],
    [language],
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

  const { videoFilterTags } = appState;

  const filteredState = useMemo<RendererVideo[]>(() => {
    const categoryFilter = getVideoCategoryFilter(category);
    const categoryState = videoState.filter(categoryFilter);

    const queryFilter = (v: RendererVideo) =>
      new VideoFilter(videoFilterTags, v, appState.language).filter();

    return categoryState.filter(queryFilter);
  }, [category, videoState, videoFilterTags]);

  /**
   * Prepare the headless table, with sorting and row expansion. This is where
   * the data is passed in to be rendered.
   */
  const table = useReactTable({
    columns,
    data: filteredState,
    state: { expanded, pagination, rowSelection },
    getRowId: (row) => row.uniqueId,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowCanExpand: () => true,
    getExpandedRowModel: getExpandedRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
  });

  return table;
};

export default useTable;
