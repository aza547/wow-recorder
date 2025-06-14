import { AppState, RendererVideo } from 'main/types';

import { Cell, flexRender, Header, Row, Table } from '@tanstack/react-table';
import React, {
  Fragment,
  MutableRefObject,
  useCallback,
  useEffect,
} from 'react';
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
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { ScrollArea } from '../ScrollArea/ScrollArea';

interface IProps {
  table: Table<RendererVideo>;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
}

/**
 * Table component for displaying available videos. Includes category appropriate
 * columns for a quick overview, the ability to sort by column.
 */
const VideoSelectionTable = (props: IProps) => {
  const { appState, setAppState, persistentProgress, table } = props;

  /**
   * Mark the row as selected and update the video player to play the first
   * viewpoint.
   */
  const onRowClick = useCallback(
    (
      event: React.MouseEvent<HTMLTableRowElement> | KeyboardEvent,
      row: Row<RendererVideo>,
    ) => {
      const allRows = table.getSortedRowModel().rows;
      const selectedRows = table.getSelectedRowModel().rows;
      const isSelected = selectedRows.some((r) => r.id === row.id);
      const targetIndex = allRows.findIndex((r) => r.id === row.id);

      if (event.shiftKey) {
        const baseIndex = selectedRows[0]
          ? allRows.findIndex((r) => r.id === selectedRows[0].id)
          : 0;

        const start = Math.min(baseIndex, targetIndex);
        const end = Math.max(baseIndex, targetIndex) + 1;

        allRows.slice(start, end).forEach((r) => {
          if (!r.getIsSelected()) {
            r.getToggleSelectedHandler()(event);
          }
        });

        return;
      }

      if (event.ctrlKey) {
        // Add a single row to the Selection.
        row.getToggleSelectedHandler()(event);
        return;
      }

      const video = row.original;
      const povs = [video, ...video.multiPov].sort(povDiskFirstNameSort);
      persistentProgress.current = 0;

      // It's a regular click, so unselect any other selected rows.
      selectedRows.forEach((r) => {
        if (r.id !== row.id) {
          r.getToggleSelectedHandler()(event);
        }
      });

      // Make sure the clicked row is selected after we're done.
      if (!isSelected) {
        row.getToggleSelectedHandler()(event);
      }

      setAppState((prevState) => ({
        ...prevState,
        selectedVideos: povs[0] ? [povs[0]] : [],
        multiPlayerMode: false,
        playing: false,
      }));
    },
    [persistentProgress, setAppState, table],
  );

  /**
   * Allow control and shift to select multi or ranges of
   * selections, respectively. Also allow arrow key up and down
   * for navigation and selection.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const sortedRows = table.getSortedRowModel().rows;
      const selectedRows = table.getSelectedRowModel().rows;

      if (event.key === 'a' && event.ctrlKey) {
        sortedRows.forEach((row) => {
          if (!row.getIsSelected()) {
            row.getToggleSelectedHandler()(event);
          }
        });

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
        !event.repeat
      ) {
        if (selectedRows.length === 0) return;

        const currentRow =
          event.key === 'ArrowDown'
            ? selectedRows[selectedRows.length - 1]
            : selectedRows[0];

        const currentIndex = sortedRows.findIndex(
          (r) => r.id === currentRow.id,
        );
        const nextIndex =
          event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
        const nextRow = sortedRows[nextIndex];

        if (nextRow) {
          onRowClick(event, nextRow);
        }

        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.shiftKey || event.ctrlKey) event.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [table, onRowClick]);

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

    const width =
      header.column.getSize() === Number.MAX_SAFE_INTEGER
        ? 'auto'
        : header.column.getSize();

    return (
      <th key={header.id} colSpan={header.colSpan} style={{ width }}>
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
      <thead className="border-video-border border-b border-t mx-2">
        <tr>{headers.map(renderIndividualHeader)}</tr>
      </thead>
    );
  };

  /**
   * Render a cell in the base row.
   */
  const renderBaseCell = (cell: Cell<RendererVideo, unknown>) => {
    const width =
      cell.column.getSize() === Number.MAX_SAFE_INTEGER
        ? 'auto'
        : cell.column.getSize();

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
      className += 'bg-secondary/100 ';
    } else if (row.index % 2 === 0) {
      className += 'bg-secondary/15 ';
    }

    return (
      <tr
        key={row.id}
        className={className}
        onClick={(event) => onRowClick(event, row)}
      >
        {cells.map(renderBaseCell)}
      </tr>
    );
  };

  /**
   * Render an individual row of the table.
   */
  const renderRow = (row: Row<RendererVideo>) => {
    const selected =
      row.getIsSelected() ||
      (!table.getIsSomeRowsSelected() && row.index === 0);

    return <Fragment key={row.id}>{renderBaseRow(row, selected)}</Fragment>;
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

  return (
    <div className="w-full h-full overflow-hidden px-2">
      <ScrollArea withScrollIndicators={false} className="h-full w-full">
        <div className="pb-2 px-6">
          <table className="table-fixed w-full">
            {renderTableHeader()}
            {renderTableBody()}
          </table>
          {renderPagnationButtons()}
        </div>
      </ScrollArea>
    </div>
  );
};

export default VideoSelectionTable;
