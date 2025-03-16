import { AppState, RendererVideo } from 'main/types';

import { Cell, flexRender, Header, Row, Table } from '@tanstack/react-table';
import { Fragment, MutableRefObject, useEffect, useState } from 'react';
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
import { getSelectedRowIndex, povDiskFirstNameSort } from '../../rendererutils';
import { Button } from '../Button/Button';
import { getLocalePhrase, Phrase } from 'localisation/translations';

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

  const { category, selectedVideos } = appState;

  const [shiftDown, setShiftDown] = useState<boolean>(false);
  const [ctrlDown, setCtrlDown] = useState<boolean>(false);

  /**
   * Allow control and shift to select multi or ranges of
   * selections, respectively.
   */
  useEffect(() => {
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') setCtrlDown(false);
      if (event.key === 'Shift') setShiftDown(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') setCtrlDown(true);
      if (event.key === 'Shift') setShiftDown(true);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.shiftKey || event.ctrlKey) event.preventDefault();
    };

    const handleBlur = () => {
      setCtrlDown(false);
      setShiftDown(false);
    };

    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  /**
   * Mark the row as selected and update the video player to play the first
   * viewpoint.
   */
  const onRowClick = (
    event: React.MouseEvent<HTMLTableRowElement>,
    row: Row<RendererVideo>,
  ) => {
    if (shiftDown) {
      const { rows } = table.getRowModel();
      const base = getSelectedRowIndex(selectedVideos, table);
      const target = row.index;
      const start = Math.min(base, target);
      const end = Math.max(base, target) + 1;

      rows.slice(start, end).forEach((r) => {
        if (!r.getIsSelected()) {
          r.getToggleSelectedHandler()(event);
        }
      });

      return;
    }

    if (ctrlDown) {
      row.getToggleSelectedHandler()(event);
      return;
    }

    const video = row.original;
    const povs = [video, ...video.multiPov].sort(povDiskFirstNameSort);

    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        selectedVideos: povs[0] ? [povs[0]] : [],
        multiPlayerMode: false,
        playing: false,
      };
    });
  };

  /**
   * Select the row and expand it.
   */
  const onRowDoubleClick = (
    event: React.MouseEvent<HTMLTableRowElement>,
    row: Row<RendererVideo>,
  ) => {
    if (ctrlDown || shiftDown) {
      // Just do a single click. Probably an accident.
      onRowClick(event, row);
      return;
    }

    onRowClick(event, row);
    row.getToggleExpandedHandler()();
  };

  /**
   * Render an individual header.
   */
  const renderIndividualHeader = (header: Header<RendererVideo, unknown>) => {
    let tooltip;

    if (header.column.getCanSort()) {
      if (header.column.getNextSortingOrder() === 'asc') {
        tooltip = getLocalePhrase(appState.language, Phrase.ClickToSortAsc);
      } else if (header.column.getNextSortingOrder() === 'desc') {
        tooltip = getLocalePhrase(appState.language, Phrase.ClickToSortDec);
      } else {
        tooltip = getLocalePhrase(appState.language, Phrase.ClickToClearSort);
      }
    }

    if (header.id === 'Select') {
      tooltip = getLocalePhrase(appState.language, Phrase.ClickToSelectAll);
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
        onClick={(event) => onRowClick(event, row)}
        onDoubleClick={(event) => onRowDoubleClick(event, row)}
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
    const povNames = povs.map((rv) => rv.videoName);
    const selectedNames = selectedVideos.map((rv) => rv.videoName);

    const selected =
      selectedVideos.length < 1
        ? row.index === 0
        : Boolean(povNames.find((n) => selectedNames.includes(n)));

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
    const povNames = povs.map((rv) => rv.videoName);
    const selectedNames = selectedVideos.map((rv) => rv.videoName);

    const selected =
      selectedVideos.length < 1
        ? row.index === 0
        : Boolean(povNames.find((n) => selectedNames.includes(n)));

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
    const indicator = `${current} of ${total}`;

    return (
      <div className="flex w-full justify-center items-center gap-2 border-t border-video-border pt-2">
        <Button
          className="p-1"
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
          size="sm"
          variant="secondary"
        >
          <ChevronsLeft />
        </Button>
        <Button
          className="p-1"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          size="sm"
          variant="secondary"
        >
          <ChevronLeft />
        </Button>
        <Button
          className="p-1"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          size="sm"
          variant="secondary"
        >
          <ChevronRight />
        </Button>
        <Button
          className="p-1"
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
