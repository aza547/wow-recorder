import { AppState, RendererVideo } from 'main/types';

import {
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
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
  getFormattedDuration,
  getInstanceDifficultyText,
  getPullNumber,
  getResultColor,
  getVideoDate,
  getVideoResultText,
  getVideoTime,
  povNameSort,
} from '../../rendererutils';
import { Button } from '../Button/Button';

interface IProps {
  videoState: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  stateManager: MutableRefObject<StateManager>;
}

const RaidSelectionTable = (props: IProps) => {
  const { videoState, appState, setAppState, stateManager } = props;

  const [selectedRowId, setSelectedRowId] = useState<string>('0');
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const onRowClick = (row: Row<RendererVideo>) => {
    const video = row.original;
    const povs = [video, ...video.multiPov].sort(povNameSort);

    setSelectedRowId(row.id);
    setAppState((prevState) => {
      return {
        ...prevState,
        selectedVideoName: video.videoName,
        playingVideo: povs[0],
      };
    });
  };

  const columns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        accessorKey: 'encounterName',
        header: 'Encounter',
        cell: (info) => info.getValue(),
      },
      {
        accessorFn: (v) => v,
        header: 'Result',
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
        accessorFn: (v) => v,
        header: 'Pull',
        cell: (info) => {
          const rawValue = info.getValue() as RendererVideo;
          return getPullNumber(rawValue, videoState);
        },
      },
      {
        accessorFn: (v) => v,
        header: 'Difficulty',
        cell: (info) => {
          const rawValue = info.getValue() as RendererVideo;
          return getInstanceDifficultyText(rawValue);
        },
      },
      {
        accessorFn: (v) => v,
        header: 'Duration',
        cell: (info) => {
          const rawValue = info.getValue() as RendererVideo;
          return getFormattedDuration(rawValue);
        },
      },
      {
        accessorFn: (v) => v,
        header: 'Date',
        cell: (info) => {
          const rawValue = info.getValue() as RendererVideo;
          return `${getVideoTime(rawValue)} ${getVideoDate(rawValue)} `;
        },
      },
      {
        accessorFn: (v) => v,
        header: 'Viewpoints',
        cell: (info) => {
          const video = info.getValue() as RendererVideo;
          const povs = [video, ...video.multiPov];
          return povs.length;
        },
      },
      {
        header: 'Details',
        cell: ({ row }) => {
          return (
            <Button
              onClick={row.getToggleExpandedHandler()}
              style={{ cursor: 'pointer' }}
            >
              {row.getIsExpanded() ? (
                <KeyboardDoubleArrowUpIcon />
              ) : (
                <KeyboardDoubleArrowDownIcon />
              )}
            </Button>
          );
        },
      },
    ],
    [videoState]
  );

  const data = videoState;

  const table = useReactTable({
    columns,
    data,
    debugTable: true,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(), // client-side sorting
    getRowCanExpand: () => true,
    getExpandedRowModel: getExpandedRowModel(),
  });

  const getViewpointSelection = (row: Row<RendererVideo>) => {
    const video = row.original;
    const povs = [video, ...video.multiPov].sort(povNameSort);

    return (
      <ViewpointSelection
        povs={povs}
        parentButtonSelected
        appState={appState}
        setLocalPovIndex={0}
        setAppState={setAppState}
        persistentProgress={1}
      />
    );
  };

  const getRaidEncounterInfo = (row: Row<RendererVideo>) => {
    const video = row.original;
    return <RaidEncounterInfo video={video} />;
  };

  const getRaidCompAndResult = (row: Row<RendererVideo>) => {
    const video = row.original;
    return <RaidCompAndResult video={video} />;
  };

  const getViewpointInformation = (row: Row<RendererVideo>) => {
    const video = row.original;
    const povs = [video, ...video.multiPov].sort(povNameSort);

    return (
      <ViewpointInfo
        povs={povs}
        parentButtonSelected
        appState={appState}
        setLocalPovIndex={0}
        setAppState={setAppState}
        persistentProgress={1}
      />
    );
  };

  const getViewpointButtons = (row: Row<RendererVideo>) => {
    const video = row.original;
    const povs = [video, ...video.multiPov].sort(povNameSort);

    return (
      <ViewpointButtons
        povs={povs}
        parentButtonSelected
        appState={appState}
        setLocalPovIndex={0}
        setAppState={setAppState}
        persistentProgress={1}
        stateManager={stateManager}
      />
    );
  };

  return (
    <div className="w-full flex justify-evenly border-b border-video-border items-center gap-x-5 p-2">
      <table className="table-fixed w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className="text-left border-b border-video-border"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? 'cursor-pointer select-none  px-2'
                            : 'px-2'
                        }
                        onClick={header.column.getToggleSortingHandler()}
                        title={
                          header.column.getCanSort()
                            ? header.column.getNextSortingOrder() === 'asc'
                              ? 'Sort ascending'
                              : header.column.getNextSortingOrder() === 'desc'
                              ? 'Sort descending'
                              : 'Clear sort'
                            : undefined
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: ' 🔼',
                          desc: ' 🔽',
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            return (
              <Fragment key={row.id}>
                <tr
                  key={row.id}
                  onClick={() => onRowClick(row)}
                  className={`cursor-pointer hover:bg-secondary/80 ${
                    row.id === selectedRowId ? 'bg-secondary/80' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td className="px-2 truncate" key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length}>
                      <div className="flex border-secondary border border-t-0 rounded-b-sm">
                        <div className="p-2 flex-shrink-0">{getViewpointSelection(row)}</div>
                        <div className="flex justify-evenly w-full">
                          <div className="flex flex-col p-2 items-center justify-center">
                            {getRaidCompAndResult(row)}
                            {getRaidEncounterInfo(row)}
                          </div>
                          <div className="flex flex-col p-2 items-center justify-center">
                            {getViewpointInformation(row)}
                            {getViewpointButtons(row)}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RaidSelectionTable;
