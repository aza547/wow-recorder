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
import { Fragment, MutableRefObject, useMemo, useState } from 'react';
import ViewpointSelection from 'renderer/components/Viewpoints/ViewpointSelection';
import ViewpointInfo from 'renderer/components/Viewpoints/ViewpointInfo';
import ViewpointButtons from 'renderer/components/Viewpoints/ViewpointButtons';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import StateManager from 'renderer/StateManager';
import RaidEncounterInfo from 'renderer/RaidEncounterInfo';
import RaidCompAndResult from 'renderer/RaidComp';
import {
  CalendarDays,
  Hourglass,
  Eye,
  Trophy,
  Gamepad2,
  Hash,
  Swords,
} from 'lucide-react';
import {
  countUniqueViewpoints,
  dateToHumanReadable,
  getFormattedDuration,
  getInstanceDifficultyText,
  getPullNumber,
  getResultColor,
  getVideoResultText,
  povNameSort,
  videoToDate,
} from '../../rendererutils';
import { Button } from '../Button/Button';

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
const RaidSelectionTable = (props: IProps) => {
  const {
    videoState,
    appState,
    setAppState,
    stateManager,
    persistentProgress,
  } = props;

  const [selectedRowId, setSelectedRowId] = useState<string>('0');
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const onRowClick = (row: Row<RendererVideo>) => {
    const video = row.original;
    const povs = [video, ...video.multiPov].sort(povNameSort);

    setSelectedRowId(row.id);
    setAppState((prevState) => {
      return {
        ...prevState,
        playingVideo: povs[0],
      };
    });
  };

  /**
   * Define the columns, the data access, sorting functions and any display
   * transformations.
   */
  const columns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        accessorKey: 'encounterName',
        id: 'Encounter',
        header: () => (
          <span className="inline-flex gap-x-1">
            <Gamepad2 />
            Encounter
          </span>
        ),
        cell: (info) => info.getValue(),
      },
      {
        accessorFn: (v) => v,
        sortingFn: (a, b) => {
          const resultA = getVideoResultText(a.original);
          const resultB = getVideoResultText(b.original);
          return resultB.localeCompare(resultA);
        },
        id: 'Result',
        header: () => (
          <span className="inline-flex gap-x-1">
            <Trophy />
            Result
          </span>
        ),
        cell: (info) => {
          const video = info.getValue() as RendererVideo;
          const resultText = getVideoResultText(video);
          const resultColor = getResultColor(video);

          return (
            <span
              className="text-white font-sans font-semibold text-sm text-shadow-instance text-center"
              style={{ color: resultColor }}
            >
              {resultText}
            </span>
          );
        },
      },
      {
        id: 'Pull',
        accessorFn: (v) => getPullNumber(v, videoState),
        header: () => (
          <span className="inline-flex gap-x-1">
            <Hash />
            Pull
          </span>
        ),
      },
      {
        id: 'Difficulty',
        accessorFn: (v) => getInstanceDifficultyText(v),
        header: () => (
          <span className="inline-flex gap-x-1">
            <Swords />
            Difficulty
          </span>
        ),
      },
      {
        id: 'Duration',
        accessorFn: (v) => v,
        sortingFn: (a, b) => {
          const resultA = a.original.duration;
          const resultB = b.original.duration;
          return resultA - resultB;
        },
        header: () => (
          <span className="inline-flex gap-x-1">
            <Hourglass />
            Duration
          </span>
        ),
        cell: (info) => {
          const rawValue = info.getValue() as RendererVideo;
          return getFormattedDuration(rawValue);
        },
      },
      {
        id: 'Date',
        accessorFn: (v) => videoToDate(v),
        header: () => (
          <span className="inline-flex gap-x-1">
            <CalendarDays />
            Date
          </span>
        ),
        cell: (info) => {
          const date = info.getValue() as Date;
          return dateToHumanReadable(date);
        },
      },
      {
        id: 'Viewpoints',
        accessorFn: (v) => {
          const video = v;
          return countUniqueViewpoints(video);
        },
        header: () => (
          <span className="inline-flex gap-x-1">
            <Eye />
            Viewpoints
          </span>
        ),
      },
      {
        id: 'Details',
        size: 50,
        cell: ({ row }) => {
          return (
            <Button
              onClick={row.getToggleExpandedHandler()}
              style={{ cursor: 'pointer' }}
              size="sm"
              variant="ghost"
            >
              {row.getIsExpanded() && selectedRowId === row.id ? (
                <KeyboardDoubleArrowUpIcon />
              ) : (
                <KeyboardDoubleArrowDownIcon />
              )}
            </Button>
          );
        },
      },
    ],
    [selectedRowId, videoState]
  );

  /**
   * Prepare the headless table, with sorting and row expansion. This is where
   * the data is passed in to be rendered.
   */
  const table = useReactTable({
    columns,
    data: videoState,
    state: { expanded },
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
          className="cursor-pointer select-none px-2"
          onClick={header.column.getToggleSortingHandler()}
          title={tooltip}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          {/* {{
            asc: ' 🔼',
            desc: ' 🔽',
          }[header.column.getIsSorted() as string] ?? null} */}
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
      <td className="px-2 truncate" key={cell.id} style={{ width }}>
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
   * Render the expanded row.
   */
  const renderExpandedRow = (row: Row<RendererVideo>) => {
    const cells = row.getVisibleCells();

    return (
      <tr>
        <td colSpan={cells.length}>
          <div className="flex border-secondary border border-t-0 rounded-b-sm">
            <div className="p-2 flex-shrink-0">
              <ViewpointSelection
                video={row.original}
                appState={appState}
                setAppState={setAppState}
              />
            </div>
            <div className="flex justify-evenly w-full">
              <div className="flex flex-col p-2 items-center justify-center">
                <RaidCompAndResult video={row.original} />
                <RaidEncounterInfo video={row.original} />
              </div>
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
    const selected = row.id === selectedRowId;

    return (
      <Fragment key={row.id}>
        {renderBaseRow(row, selected)}
        {row.getIsExpanded() && selected && renderExpandedRow(row)}
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

export default RaidSelectionTable;
