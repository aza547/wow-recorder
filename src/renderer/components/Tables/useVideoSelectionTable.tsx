import {
  ColumnDef,
  createPaginatedRowModel,
  createSortedRowModel,
  PaginationState,
  RowSelectionState,
  stockFeatures,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { RendererVideo, AppState, RendererClip, DialogType } from 'main/types';
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  getPullNumber,
  getInstanceDifficultyText,
  videoToDate,
  getDungeonName,
  povDiskFirstNameSort,
  getVideoGroup,
  getVideoParent,
} from 'renderer/rendererutils';
import { VideoCategory } from 'types/VideoCategory';
import {
  populateEncounterNameCell,
  populateResultCell,
  populateDurationCell,
  populateDateCell,
  populateViewpointCell,
  populateDetailsCell,
  populateMapCell,
  populateLevelCell,
  populateActivityCell,
  populateAffixesCell,
  populateSourceCell,
  populateKillVideoCell,
} from './Cells';
import {
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
  AffixesHeader,
  ClippedAtHeader,
} from './Headers';
import {
  resultSort,
  durationSort,
  viewPointCountSort,
  levelSort,
  detailSort,
  clipActivitySort,
  killVideoCreatorSort,
} from './Sorting';
import { getLocaleCategoryLabel } from 'localisation/translations';

const useVideoSelectionTable = (
  videoState: Array<RendererVideo>,
  parentLookupMap: Map<string, RendererVideo>,
  appState: AppState,
  setAppState: Dispatch<SetStateAction<AppState>>,
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>,
  getClipParent: (clip: RendererClip) => RendererVideo | undefined,
  goToClipParent: (clip: RendererClip) => void,
  setDialog: Dispatch<SetStateAction<DialogType>>,
  setLockDialogVideoTargetId: Dispatch<SetStateAction<string | null>>,
  setTagDialogVideoTargetId: Dispatch<SetStateAction<string | null>>,
  setKillDialogVideoTargetId: Dispatch<SetStateAction<string | null>>,
) => {
  const { category, language, cloudStatus, selectedVideos } = appState;

  const getInitialSelection = useCallback(() => {
    if (videoState.length < 1) {
      return null;
    }

    const [first] = videoState;
    const { uniqueId } = first;
    return getVideoParent(uniqueId, parentLookupMap);
  }, [parentLookupMap, videoState]);

  /**
   * Tracks if rows are selected or not in the ReactTable component. Initialize
   * this here with any selected videos, which is important when seeking here
   * programatically (i.e. using the seek to clip source function).
   */
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(() => {
    const initial = getInitialSelection();
    return initial ? { [initial.uniqueId]: true } : {};
  });

  /**
   * Controls the table pagination.
   */
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

  // Tanstack table relies on stable references, so while we have the React
  // compiler enabled we still need useMemo here or weird stuff will happen.
  const raidColumns: ColumnDef<typeof stockFeatures, RendererVideo, unknown>[] =
    [
      {
        id: 'Details',
        size: 80,
        accessorFn: (v) => v,
        sortFn: (a, b) => detailSort(a, b),
        header: DetailsHeader,
        cell: (ctx) =>
          populateDetailsCell(
            ctx,
            language,
            cloudStatus,
            setVideoState,
            setDialog,
            setLockDialogVideoTargetId,
            setTagDialogVideoTargetId,
          ),
      },
      {
        id: 'Encounter',
        size: 300,
        accessorKey: 'encounterName',
        header: () => EncounterHeader(language),
        cell: populateEncounterNameCell,
      },
      {
        id: 'Result',
        accessorFn: (v) => v,
        sortFn: (a, b) => resultSort(a, b, language),
        header: () => ResultHeader(language),
        cell: (ctx) => populateResultCell(ctx, language),
      },
      {
        id: 'Pull',
        size: 100,
        accessorFn: (v) => getPullNumber(v, videoState),
        header: () => PullHeader(language),
      },
      {
        id: 'Difficulty',
        accessorFn: (v) => getInstanceDifficultyText(v, language),
        header: () => DifficultyHeader(language),
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortFn: durationSort,
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
        size: 180,
        accessorFn: (v) => v,
        header: () => ViewpointsHeader(language),
        cell: (v) => populateViewpointCell(v),
        sortFn: viewPointCountSort,
      },
      {
        id: 'Kill Video Creator',
        size: 50,
        accessorFn: (v) => v,
        sortFn: (a, b) => killVideoCreatorSort(a, b),
        header: DetailsHeader,
        cell: (ctx) =>
          populateKillVideoCell(
            ctx,
            language,
            setDialog,
            setKillDialogVideoTargetId,
          ),
      },
    ];

  /**
   * The arena table columns, the data access, sorting functions
   * and any display transformations.
   */
  const arenaColumns: ColumnDef<
    typeof stockFeatures,
    RendererVideo,
    unknown
  >[] = [
    {
      id: 'Details',
      size: 80,
      accessorFn: (v) => v,
      sortFn: (a, b) => detailSort(a, b),
      header: DetailsHeader,
      cell: (ctx) =>
        populateDetailsCell(
          ctx,
          language,
          cloudStatus,
          setVideoState,
          setDialog,
          setLockDialogVideoTargetId,
          setTagDialogVideoTargetId,
        ),
    },
    {
      id: 'Map',
      size: 300,
      accessorKey: 'zoneName',
      header: () => MapHeader(language),
      cell: populateMapCell,
    },
    {
      id: 'Result',
      accessorFn: (v) => v,
      sortFn: (a, b) => resultSort(a, b, language),
      header: () => ResultHeader(language),
      cell: (c) => populateResultCell(c, language),
    },
    {
      id: 'Duration',
      accessorFn: (v) => v,
      sortFn: durationSort,
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
      size: 180,
      accessorFn: (v) => v,
      header: () => ViewpointsHeader(language),
      cell: (v) => populateViewpointCell(v),
      sortFn: viewPointCountSort,
    },
  ];

  /**
   * The dungeon table columns, the data access, sorting functions
   * and any display transformations.
   */
  const dungeonColumns: ColumnDef<
    typeof stockFeatures,
    RendererVideo,
    unknown
  >[] = [
    {
      id: 'Details',
      size: 80,
      accessorFn: (v) => v,
      sortFn: (a, b) => detailSort(a, b),
      header: DetailsHeader,
      cell: (ctx) =>
        populateDetailsCell(
          ctx,
          language,
          cloudStatus,
          setVideoState,
          setDialog,
          setLockDialogVideoTargetId,
          setTagDialogVideoTargetId,
        ),
    },
    {
      id: 'Map',
      size: 300,
      accessorFn: getDungeonName,
      header: () => MapHeader(language),
      cell: populateMapCell,
    },
    {
      id: 'Result',
      accessorFn: (v) => v,
      sortFn: (a, b) => resultSort(a, b, language),
      header: () => ResultHeader(language),
      cell: (c) => populateResultCell(c, language),
    },
    {
      id: 'Level',
      accessorFn: (v) => v,
      sortFn: levelSort,
      header: () => LevelHeader(language),
      cell: populateLevelCell,
    },
    {
      id: 'Affixes',
      accessorFn: (v) => v,
      sortFn: levelSort,
      header: () => AffixesHeader(),
      cell: populateAffixesCell,
    },
    {
      id: 'Duration',
      accessorFn: (v) => v,
      sortFn: durationSort,
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
      size: 180,
      accessorFn: (v) => v,
      header: () => ViewpointsHeader(language),
      cell: (v) => populateViewpointCell(v),
      sortFn: viewPointCountSort,
    },
  ];

  /**
   * The battleground table columns, the data access, sorting functions
   * and any display transformations.
   */
  const battlegroundColumns: ColumnDef<
    typeof stockFeatures,
    RendererVideo,
    unknown
  >[] = [
    {
      id: 'Details',
      size: 80,
      accessorFn: (v) => v,
      sortFn: (a, b) => detailSort(a, b),
      header: DetailsHeader,
      cell: (ctx) =>
        populateDetailsCell(
          ctx,
          language,
          cloudStatus,
          setVideoState,
          setDialog,
          setLockDialogVideoTargetId,
          setTagDialogVideoTargetId,
        ),
    },
    {
      id: 'Map',
      size: 300,
      accessorKey: 'zoneName',
      header: () => MapHeader(language),
      cell: populateMapCell,
    },
    {
      id: 'Result',
      accessorFn: (v) => v,
      sortFn: (a, b) => resultSort(a, b, language),
      header: () => ResultHeader(language),
      cell: (c) => populateResultCell(c, language),
    },
    {
      id: 'Duration',
      accessorFn: (v) => v,
      sortFn: durationSort,
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
      size: 180,
      accessorFn: (v) => v,
      header: () => ViewpointsHeader(language),
      cell: (v) => populateViewpointCell(v),
      sortFn: viewPointCountSort,
    },
  ];

  /**
   * The battleground table columns, the data access, sorting functions
   * and any display transformations.
   */
  const clipsColumns: ColumnDef<
    typeof stockFeatures,
    RendererVideo,
    unknown
  >[] = [
    {
      id: 'Details',
      size: 80,
      accessorFn: (v) => v,
      sortFn: (a, b) => detailSort(a, b),
      header: DetailsHeader,
      cell: (ctx) =>
        populateDetailsCell(
          ctx,
          language,
          cloudStatus,
          setVideoState,
          setDialog,
          setLockDialogVideoTargetId,
          setTagDialogVideoTargetId,
        ),
    },
    {
      id: 'Type',
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
      sortFn: (a, b) => clipActivitySort(a, b, language),
      header: () => ActivityHeader(language),
      cell: (ctx) => populateActivityCell(ctx, language),
    },
    {
      id: 'Duration',
      accessorFn: (v) => v,
      sortFn: durationSort,
      header: () => DurationHeader(language),
      cell: populateDurationCell,
    },
    {
      id: 'Date',
      accessorFn: (v) => videoToDate(v),
      header: () => ClippedAtHeader(language),
      cell: populateDateCell,
    },
    {
      id: 'Viewpoints',
      size: 180,
      accessorFn: (v) => v,
      header: () => ViewpointsHeader(language),
      cell: (v) => populateViewpointCell(v),
      sortFn: viewPointCountSort,
    },
    {
      id: 'Source',
      size: 50,
      accessorFn: (v) => v,
      enableSorting: false,
      header: DetailsHeader,
      cell: (ctx) =>
        populateSourceCell(ctx, language, getClipParent, goToClipParent),
    },
  ];

  const manualColumns: ColumnDef<
    typeof stockFeatures,
    RendererVideo,
    unknown
  >[] = [
    {
      id: 'Details',
      size: 80,
      accessorFn: (v) => v,
      sortFn: (a, b) => detailSort(a, b),
      header: DetailsHeader,
      cell: (ctx) =>
        populateDetailsCell(
          ctx,
          language,
          cloudStatus,
          setVideoState,
          setDialog,
          setLockDialogVideoTargetId,
          setTagDialogVideoTargetId,
        ),
    },
    {
      id: 'Type',
      accessorFn: (v) => v,
      header: () => TypeHeader(language),
      cell: 'Manual',
    },
    {
      id: 'Duration',
      accessorFn: (v) => v,
      sortFn: durationSort,
      header: () => DurationHeader(language),
      cell: populateDurationCell,
    },
    {
      id: 'Date',
      accessorFn: (v) => videoToDate(v),
      header: () => DateHeader(language),
      cell: populateDateCell,
    },
  ];

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
    case VideoCategory.Manual:
      columns = manualColumns;
      break;
    default:
      throw new Error('Unrecognized category');
  }

  const features = tableFeatures({
    ...stockFeatures,
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
  });

  const table = useTable({
    columns,
    data: videoState,
    features,
    state: { pagination, rowSelection },
    getRowId: (row) => row.uniqueId,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    // This is a workaround for tanstack defaulting to 150px.
    // Also see the VideoSelectionTable component where we react to this.
    defaultColumn: { size: Number.MAX_SAFE_INTEGER },
  });

  useEffect(() => {
    const { rows: selected } = table.getSelectedRowModel();

    if (selected.length > 0) {
      // A row is already selected so nothing to do.
      return;
    }
    console.log(111);

    if (selectedVideos.length > 0) {
      // The video player already has a selected video. There can be up to 4
      // selected videos here but they must all be from the same table row.
      const [first] = selectedVideos;
      const { uniqueId } = first;
      const group = getVideoGroup(uniqueId, parentLookupMap);

      if (group.length > 0) {
        // No sorting here. The uniqueId must match the parent video which
        // the row represents to be marked as selected in the table.
        setRowSelection({ [group[0].uniqueId]: true });
        return;
      }
    }
    console.log(222);

    // If everything so far failed then just select the first row in the table.
    const initial = getInitialSelection();

    if (initial) {
      setRowSelection({ [initial.uniqueId]: true });

      // The viewpoints column and the onRowClick video selection prefers
      // selection as per povDiskFirstNameSort, so we respect that here too.
      const [first] = [initial, ...initial.multiPov].sort(povDiskFirstNameSort);
      setAppState((prev) => ({ ...prev, selectedVideos: [first] }));
      return;
    }
    console.log(333);

    // Possible we get here if there are genuinely no rows in the table due
    // to overzealous filtering, but there isn't anything sensible to do.
  }, [
    getInitialSelection,
    parentLookupMap,
    selectedVideos,
    setAppState,
    table,
  ]);

  return table;
};

export default useVideoSelectionTable;
