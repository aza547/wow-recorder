/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { AppState, RendererVideo } from 'main/types';

import {
  Cell,
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  Header,
  Row,
  useReactTable,
} from '@tanstack/react-table';
import {
  Fragment,
  MutableRefObject,
  useEffect,
  useMemo,
  useState,
} from 'react';
import ViewpointSelection from 'renderer/components/Viewpoints/ViewpointSelection';
import ViewpointInfo from 'renderer/components/Viewpoints/ViewpointInfo';
import ViewpointButtons from 'renderer/components/Viewpoints/ViewpointButtons';
import StateManager from 'renderer/StateManager';
import RaidEncounterInfo from 'renderer/RaidEncounterInfo';
import RaidCompAndResult from 'renderer/RaidComp';
import { VideoCategory } from 'types/VideoCategory';
import DungeonInfo from 'renderer/DungeonInfo';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  countUniqueViewpoints,
  getDungeonName,
  getInstanceDifficultyText,
  getPullNumber,
  povNameSort,
  videoToDate,
} from '../../rendererutils';
import {
  DateHeader,
  DifficultyHeader,
  DurationHeader,
  EncounterHeader,
  LevelHeader,
  MapHeader,
  PullHeader,
  ResultHeader,
  TagHeader,
  TypeHeader,
  ViewpointsHeader,
} from './Headers';
import { durationSort, levelSort, resultSort } from './Sorting';
import {
  populateDateCell,
  populateDetailsCell,
  populateDurationCell,
  populateEncounterNameCell,
  populateLevelCell,
  populateMapCell,
  populateResultCell,
  populateTagCell,
} from './Cells';

interface IProps {
  videoState: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  stateManager: MutableRefObject<StateManager>;
  persistentProgress: MutableRefObject<number>;
}

/**
 * Table component for displaying available videos. Includes category appropriate
 * columns for a quick overview, the ability to sort by column, and the option to
 * expand a specific activity for more details and controls.
 */
const VideoSelectionTable = (props: IProps) => {
  const {
    videoState,
    appState,
    setAppState,
    stateManager,
    persistentProgress,
  } = props;

  const [expanded, setExpanded] = useState<ExpandedState>({});

  /**
   * Reset expanded on changing category.
   */
  useEffect(() => {
    setExpanded({});
  }, [appState.category]);

  /**
   * Mark the row as selected and update the video player to play the first
   * viewpoint.
   */
  const onRowClick = (row: Row<RendererVideo>) => {
    const video = row.original;
    const povs = [video, ...video.multiPov].sort(povNameSort);

    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        playingVideo: povs[0],
      };
    });
  };

  /**
   * The raid table columns, the data access, sorting functions
   * and any display transformations.
   */
  const raidColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Encounter',
        accessorKey: 'encounterName',
        header: EncounterHeader,
        cell: populateEncounterNameCell,
      },
      {
        id: 'Result',
        accessorFn: (v) => v,
        sortingFn: resultSort,
        header: ResultHeader,
        cell: populateResultCell,
      },
      {
        id: 'Pull',
        accessorFn: (v) => getPullNumber(v, videoState),
        header: PullHeader,
      },
      {
        id: 'Difficulty',
        accessorFn: (v) => getInstanceDifficultyText(v),
        header: DifficultyHeader,
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: DurationHeader,
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: DateHeader,
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => countUniqueViewpoints(v),
        header: ViewpointsHeader,
      },
      {
        id: 'Details',
        size: 50,
        cell: populateDetailsCell,
      },
    ],
    [videoState]
  );

  /**
   * The arena table columns, the data access, sorting functions
   * and any display transformations.
   */
  const arenaColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Map',
        accessorKey: 'zoneName',
        header: MapHeader,
        cell: populateMapCell,
      },
      {
        id: 'Result',
        accessorFn: (v) => v,
        sortingFn: resultSort,
        header: ResultHeader,
        cell: populateResultCell,
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: DurationHeader,
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: DateHeader,
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => countUniqueViewpoints(v),
        header: ViewpointsHeader,
      },
      {
        id: 'Details',
        size: 50,
        cell: populateDetailsCell,
      },
    ],
    []
  );

  /**
   * The dungeon table columns, the data access, sorting functions
   * and any display transformations.
   */
  const dungeonColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Map',
        accessorFn: getDungeonName,
        header: MapHeader,
        cell: populateMapCell,
      },
      {
        id: 'Result',
        accessorFn: (v) => v,
        sortingFn: resultSort,
        header: ResultHeader,
        cell: populateResultCell,
      },
      {
        id: 'Level',
        accessorFn: (v) => v,
        sortingFn: levelSort,
        header: LevelHeader,
        cell: populateLevelCell,
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: DurationHeader,
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: DateHeader,
        cell: populateDateCell,
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => countUniqueViewpoints(v),
        header: ViewpointsHeader,
      },
      {
        id: 'Details',
        size: 50,
        cell: populateDetailsCell,
      },
    ],
    []
  );

  /**
   * The battleground table columns, the data access, sorting functions
   * and any display transformations.
   */
  const battlegroundColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Map',
        accessorKey: 'zoneName',
        header: MapHeader,
        cell: populateMapCell,
      },
      {
        id: 'Result',
        accessorFn: (v) => v,
        sortingFn: resultSort,
        header: ResultHeader,
        cell: populateResultCell,
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: DurationHeader,
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: DateHeader,
        cell: populateDateCell,
      },
      {
        id: 'Details',
        size: 50,
        cell: populateDetailsCell,
      },
    ],
    []
  );

  /**
   * The battleground table columns, the data access, sorting functions
   * and any display transformations.
   */
  const clipsColumns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Type',
        accessorKey: 'parentCategory',
        header: TypeHeader,
        cell: (info) => info.getValue(),
      },
      {
        id: 'Tag',
        accessorFn: (v) => v.tag,
        header: TagHeader,
        cell: populateTagCell,
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: durationSort,
        header: DurationHeader,
        cell: populateDurationCell,
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: DateHeader,
        cell: populateDateCell,
      },
      {
        id: 'Details',
        size: 50,
        cell: populateDetailsCell,
      },
    ],
    []
  );

  const { category, playingVideo } = appState;
  let columns = raidColumns;

  if (category === VideoCategory.MythicPlus) {
    columns = dungeonColumns;
  } else if (category === VideoCategory.Battlegrounds) {
    columns = battlegroundColumns;
  } else if (category === VideoCategory.Clips) {
    columns = clipsColumns;
  } else if (
    category === VideoCategory.TwoVTwo ||
    category === VideoCategory.ThreeVThree ||
    category === VideoCategory.FiveVFive ||
    category === VideoCategory.Skirmish ||
    category === VideoCategory.SoloShuffle
  ) {
    columns = arenaColumns;
  }

  /**
   * Prepare the headless table, with sorting and row expansion. This is where
   * the data is passed in to be rendered.
   */
  const table = useReactTable({
    columns,
    data: videoState,
    state: { expanded },
    getRowId: (row) => row.uniqueId,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowCanExpand: () => true,
    getExpandedRowModel: getExpandedRowModel(),
  });

  /**
   * Render an individual header.
   */
  const renderIndividualHeader = (header: Header<RendererVideo, unknown>) => {
    let tooltip;

    if (header.column.getNextSortingOrder() === 'asc') {
      tooltip = 'Click to sort ascending';
    } else if (header.column.getNextSortingOrder() === 'desc') {
      tooltip = 'Click to sort descending';
    } else {
      tooltip = 'Click to clear sort';
    }

    return (
      <th
        key={header.id}
        colSpan={header.colSpan}
        style={{ width: header.column.getSize() }}
        className="text-left border-b border-video-border"
      >
        <div
          className="flex flex-row p-2 items-center cursor-pointer select-none"
          onClick={header.column.getToggleSortingHandler()}
          title={tooltip}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          {{
            asc: <ArrowUp />,
            desc: <ArrowDown />,
          }[header.column.getIsSorted() as string] ?? null}
        </div>
      </th>
    );
  };

  /**
   * Render the header of the selection table.
   */
  const renderTableHeader = () => {
    const groups = table.getHeaderGroups();
    const { headers } = groups[0];

    return (
      <thead>
        <tr>{headers.map(renderIndividualHeader)}</tr>
      </thead>
    );
  };

  /**
   * Render a cell in the base row.
   */
  const renderBaseCell = (cell: Cell<RendererVideo, unknown>) => {
    const width = cell.column.getSize();

    return (
      <td className="px-2" key={cell.id} style={{ width }}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </td>
    );
  };

  /**
   * Render the base row.
   */
  const renderBaseRow = (row: Row<RendererVideo>, selected: boolean) => {
    const cells = row.getVisibleCells();
    let className = 'cursor-pointer hover:bg-secondary/80 ';

    if (selected) {
      className += 'bg-secondary/80';
    }

    return (
      <tr key={row.id} className={className} onClick={() => onRowClick(row)}>
        {cells.map(renderBaseCell)}
      </tr>
    );
  };

  /**
   * Renders content specific content. Not all content types are equal here.
   */
  const renderContentSpecificInfo = (row: Row<RendererVideo>) => {
    if (category === VideoCategory.Raids) {
      return (
        <div className="flex flex-col p-2 items-center justify-center">
          <RaidCompAndResult video={row.original} />
        </div>
      );
    }

    if (category === VideoCategory.MythicPlus) {
      return (
        <div className="flex flex-col p-2 items-center justify-center">
          <DungeonInfo video={row.original} />
        </div>
      );
    }

    return <></>;
  };

  /**
   * Render the expanded row.
   */
  const renderExpandedRow = (row: Row<RendererVideo>) => {
    const cells = row.getVisibleCells();
    const povs = [row.original, ...row.original.multiPov];
    const selected = Boolean(
      povs.find((p) => p.videoName === playingVideo?.videoName)
    );

    const borderClass = selected
      ? 'border border-t-0 rounded-b-sm'
      : 'border rounded-sm';

    return (
      <tr>
        <td colSpan={cells.length}>
          <div className={`flex border-secondary ${borderClass}`}>
            <div className="p-2 flex-shrink-0">
              <ViewpointSelection
                video={row.original}
                appState={appState}
                setAppState={setAppState}
              />
            </div>
            <div className="flex justify-evenly w-full">
              {renderContentSpecificInfo(row)}
              <div className="flex flex-col p-2 items-center justify-center">
                <ViewpointInfo
                  video={row.original}
                  appState={appState}
                  setAppState={setAppState}
                />
                <ViewpointButtons
                  video={row.original}
                  appState={appState}
                  setAppState={setAppState}
                  persistentProgress={persistentProgress}
                  stateManager={stateManager}
                />
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  /**
   * Render an individual row of the table.
   */
  const renderRow = (row: Row<RendererVideo>) => {
    const povs = [row.original, ...row.original.multiPov];
    const selected = Boolean(
      povs.find((p) => p.videoName === playingVideo?.videoName)
    );

    return (
      <Fragment key={row.id}>
        {renderBaseRow(row, selected)}
        {row.getIsExpanded() && renderExpandedRow(row)}
      </Fragment>
    );
  };

  /**
   * Render the body of the selection table.
   */
  const renderTableBody = () => {
    const { rows } = table.getRowModel();
    return <tbody>{rows.map(renderRow)}</tbody>;
  };

  /**
   * Render the whole component.
   */
  const renderTable = () => {
    return (
      <div className="w-full flex justify-evenly border-b border-video-border items-center gap-x-5 p-2">
        <table className="table-fixed w-full">
          {renderTableHeader()}
          {renderTableBody()}
        </table>
      </div>
    );
  };

  return renderTable();
};

export default VideoSelectionTable;
