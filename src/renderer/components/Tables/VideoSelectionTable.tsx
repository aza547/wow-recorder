/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { AppState, RendererVideo } from 'main/types';

import { Cell, flexRender, Header, Row, Table } from '@tanstack/react-table';
import { Fragment, MutableRefObject } from 'react';
import ViewpointSelection from 'renderer/components/Viewpoints/ViewpointSelection';
import ViewpointInfo from 'renderer/components/Viewpoints/ViewpointInfo';
import ViewpointButtons from 'renderer/components/Viewpoints/ViewpointButtons';
import StateManager from 'renderer/StateManager';
import RaidCompAndResult from 'renderer/RaidComp';
import { VideoCategory } from 'types/VideoCategory';
import DungeonInfo from 'renderer/DungeonInfo';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { povDiskFirstNameSort } from '../../rendererutils';
import { Button } from '../Button/Button';

interface IProps {
  table: Table<RendererVideo>;
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
  const { appState, setAppState, stateManager, persistentProgress, table } =
    props;

  const { category, playingVideo } = appState;

  /**
   * Mark the row as selected and update the video player to play the first
   * viewpoint.
   */
  const onRowClick = (row: Row<RendererVideo>) => {
    const video = row.original;
    const povs = [video, ...video.multiPov].sort(povDiskFirstNameSort);

    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        playingVideo: povs[0],
        playing: false,
      };
    });
  };

  /**
   * Select the row and expand it.
   */
  const onRowDoubleClick = (row: Row<RendererVideo>) => {
    onRowClick(row);
    row.getToggleExpandedHandler()();
  };

  /**
   * Render an individual header.
   */
  const renderIndividualHeader = (header: Header<RendererVideo, unknown>) => {
    let tooltip;

    if (header.column.getCanSort()) {
      if (header.column.getNextSortingOrder() === 'asc') {
        tooltip = 'Click to sort ascending';
      } else if (header.column.getNextSortingOrder() === 'desc') {
        tooltip = 'Click to sort descending';
      } else {
        tooltip = 'Click to clear sort';
      }
    }

    if (header.id === 'Select') {
      tooltip = 'Click to select all';
    }

    return (
      <th
        key={header.id}
        colSpan={header.colSpan}
        style={{ width: header.column.getSize() }}
        className="text-left border-t border-b border-video-border"
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
      <tr
        key={row.id}
        className={className}
        onClick={() => onRowClick(row)}
        onDoubleClick={() => onRowDoubleClick(row)}
      >
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

    const borderClass = selected ? 'border border-t-0' : 'border';

    return (
      <tr>
        <td colSpan={cells.length}>
          <div className={`flex border-secondary ${borderClass}`}>
            <div className="p-2 flex-shrink-0">
              <ViewpointSelection
                video={row.original}
                appState={appState}
                setAppState={setAppState}
                persistentProgress={persistentProgress}
              />
            </div>
            <div className="flex justify-evenly w-full">
              {renderContentSpecificInfo(row)}
              <div className="flex flex-col p-2 items-center justify-center">
                <ViewpointInfo
                  video={row.original}
                  appState={appState}
                  setAppState={setAppState}
                  persistentProgress={persistentProgress}
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
   * For performance reasons we render videos in pages of 100. The component
   * returns buttons to navigate the pages in the list.
   */
  const renderPagnationButtons = () => {
    const current = table.getState().pagination.pageIndex + 1;
    const total = table.getPageCount().toLocaleString();
    const indicator = `${current} / ${total}`;

    return (
      <div className="flex w-full justify-center items-center gap-2 border-t border-video-border pt-2">
        <Button
          className="border rounded p-1"
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
          size="sm"
          variant="secondary"
        >
          <ChevronsLeft />
        </Button>
        <Button
          className="border rounded p-1"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          size="sm"
          variant="secondary"
        >
          <ChevronLeft />
        </Button>
        <Button
          className="border rounded p-1"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          size="sm"
          variant="secondary"
        >
          <ChevronRight />
        </Button>
        <Button
          className="border rounded p-1"
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}
          size="sm"
          variant="secondary"
        >
          <ChevronsRight />
        </Button>
        <span className="flex items-center gap-1">
          <strong>{indicator}</strong>
        </span>
      </div>
    );
  };

  /**
   * Render the whole component.
   */
  const renderTable = () => {
    return (
      <div className="w-full flex-col justify-evenly border-video-border items-center gap-x-5 p-2">
        <table className="table-fixed w-full">
          {renderTableHeader()}
          {renderTableBody()}
        </table>
        {renderPagnationButtons()}
      </div>
    );
  };

  return renderTable();
};

export default VideoSelectionTable;
