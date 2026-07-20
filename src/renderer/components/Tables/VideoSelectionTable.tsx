import { AppState, RendererVideo } from 'main/types';

import { Cell, flexRender, Header, Row, Table } from '@tanstack/react-table';
import React, { Fragment, RefObject, useCallback, useEffect } from 'react';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MousePointer,
} from 'lucide-react';
import { povDiskFirstNameSort } from '../../rendererutils';
import { Button } from '../Button/Button';
import { getLocalePhrase } from 'localisation/translations';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import { Phrase } from 'localisation/phrases';

interface IProps {
  table: Table<RendererVideo>;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: RefObject<number>;
}

/**
 * Table component for displaying available videos. Includes category appropriate
 * columns for a quick overview, the ability to sort by column.
 */
const VideoSelectionTable = (props: IProps) => {
  const { appState, setAppState, persistentProgress, table } = props;
  const {
    videoFilterTags,
    dateRangeFilter,
    storageFilter,
    preferredViewpoint,
    language,
  } = appState;

  const { pageIndex, pageSize } = table.getState().pagination;
  const selectedRowRef = React.useRef<HTMLTableRowElement>(null);

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

      let toSelect: RendererVideo | undefined;

      if (preferredViewpoint) {
        toSelect = povs.find((pov) => pov.player?._name === preferredViewpoint);
      }

      if (!toSelect) {
        toSelect = povs[0];
      }

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
        selectedVideos: toSelect ? [toSelect] : [],
        multiPlayerMode: false,
        playing: false,
      }));
    },
    [persistentProgress, setAppState, table, preferredViewpoint],
  );

  /**
   * Allow control and shift to select multi or ranges of
   * selections, respectively. Also allow arrow key up and down
   * for navigation and selection.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (event.key === 'a' && event.ctrlKey) {
        const sortedRows = table.getSortedRowModel().rows;

        sortedRows.forEach((row) => {
          if (!row.getIsSelected()) {
            row.getToggleSelectedHandler()(event);
          }
        });

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const sortedRows = table.getSortedRowModel().rows;
        const selectedRows = table.getSelectedRowModel().rows;

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
  }, [table, onRowClick, videoFilterTags, dateRangeFilter, storageFilter]);

  // If we've navigated here programatically (i.e. via the clip source button),
  // then we may already have a selected video that is not the first row. Just
  // call this whenever we mount. It's harmless if the first row is selected.
  useEffect(() => {
    const selectedIndex = table.getSelectedRowModel().rows[0]?.index ?? 0;
    const selectedPageIndex = Math.floor(selectedIndex / pageSize);

    if (selectedPageIndex !== pageIndex) {
      table.setPageIndex(selectedPageIndex);
    }

    const animationFrame = window.requestAnimationFrame(() => {
      if (!selectedRowRef.current) {
        return;
      }

      selectedRowRef.current.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [pageIndex, pageSize, table]);

  /**
   * Render an individual header.
   */
  const renderIndividualHeader = (header: Header<RendererVideo, unknown>) => {
    let tooltip;

    if (header.column.getCanSort()) {
      if (header.column.getNextSortingOrder() === 'asc') {
        tooltip = getLocalePhrase(language, Phrase.ClickToSortAsc);
      } else if (header.column.getNextSortingOrder() === 'desc') {
        tooltip = getLocalePhrase(language, Phrase.ClickToSortDec);
      } else {
        tooltip = getLocalePhrase(language, Phrase.ClickToClearSort);
      }
    }

    if (header.id === 'Select') {
      tooltip = getLocalePhrase(language, Phrase.ClickToSelectAll);
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
  const renderBaseRow = (
    row: Row<RendererVideo>,
    selected: boolean,
    sortedIndex: number,
  ) => {
    const cells = row.getVisibleCells();
    let className = 'cursor-pointer hover:bg-secondary/80 ';

    if (selected) {
      className += 'bg-secondary/100 ';
    } else if (sortedIndex % 2 === 0) {
      className += 'bg-secondary/15 ';
    }

    return (
      <tr
        key={row.id}
        ref={selected ? selectedRowRef : undefined}
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
  const renderRow = (row: Row<RendererVideo>, sortedIndex: number) => {
    const selected =
      row.getIsSelected() ||
      (!table.getIsSomeRowsSelected() && row.index === 0);

    return (
      <Fragment key={row.id}>
        {renderBaseRow(row, selected, sortedIndex)}
      </Fragment>
    );
  };

  const renderTableBody = () => {
    const { rows } = table.getRowModel();
    return <tbody>{rows.map((row, i) => renderRow(row, i))}</tbody>;
  };

  const renderHotkeyTipPointer = (key: string, action: Phrase) => {
    const { language } = appState;

    return (
      <div className="flex gap-1 items-center text-foreground-lighter text-sm">
        <div className="inline-flex whitespace-nowrap items-center border border-card rounded-sm p-1 bg-card">
          {key} + <MousePointer size={16} />
        </div>
        <div className="text-foreground">
          {getLocalePhrase(language, action)}
        </div>
      </div>
    );
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
      <div className="grid w-full grid-cols-3 items-center border-t border-video-border pt-2">
        <div className="flex gap-4">
          {renderHotkeyTipPointer('Shift', Phrase.SelectRange)}
          {renderHotkeyTipPointer('Ctrl', Phrase.SelectMultiple)}
        </div>

        <div className="flex justify-center items-center gap-2">
          <Button
            className="p-1"
            onClick={() => table.firstPage()}
            disabled={!table.getCanPreviousPage()}
            size="xs"
            variant="secondary"
          >
            <ChevronsLeft size={16} />
          </Button>

          <Button
            className="p-1"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            size="xs"
            variant="secondary"
          >
            <ChevronLeft size={16} />
          </Button>

          <span className="flex items-center gap-1 text-foreground text-sm">
            {indicator}
          </span>

          <Button
            className="p-1"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            size="xs"
            variant="secondary"
          >
            <ChevronRight size={16} />
          </Button>

          <Button
            className="p-1"
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage()}
            size="xs"
            variant="secondary"
          >
            <ChevronsRight size={16} />
          </Button>
        </div>

        <div className="justify-end flex gap-4 items-center text-foreground-lighter text-sm">
          <div className="flex gap-1 items-center text-foreground-lighter text-sm">
            <div className="inline-flex whitespace-nowrap items-center border border-card rounded-sm p-1 bg-card gap-1">
              {getLocalePhrase(language, Phrase.Arrows)}
              <ArrowDownUp size={16} />
            </div>
            <div className="text-foreground">
              {getLocalePhrase(language, Phrase.Navigate)}
            </div>
          </div>
          <div className="flex gap-1 items-center text-foreground-lighter text-sm">
            <div className="inline-flex whitespace-nowrap items-center border border-card rounded-sm p-1 bg-card">
              Ctrl + A
            </div>
            <div className="text-foreground">
              {getLocalePhrase(language, Phrase.SelectAll)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full overflow-hidden px-2">
      <ScrollArea withScrollIndicators={false} className="h-full w-full">
        <div className="pb-2 px-4">
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
