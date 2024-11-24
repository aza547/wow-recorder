/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */

import { Cell, flexRender, Header, Row, Table } from '@tanstack/react-table';
import { table } from 'console';
import { AppState, RendererVideo } from 'main/types';
import { Fragment, MutableRefObject } from 'react';
import DungeonInfo from 'renderer/DungeonInfo';
import StateManager from 'renderer/StateManager';
import ViewpointButtons from '../Viewpoints/ViewpointButtons';
import ViewpointInfo from '../Viewpoints/ViewpointInfo';
import ViewpointSelection from '../Viewpoints/ViewpointSelection';

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
const renderTableHeader = (table: Table<RendererVideo>) => {
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
const renderBaseRow = (
  row: Row<RendererVideo>,
  selected: boolean,
  onRowClick: (row: Row<RendererVideo>) => void
) => {
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
const renderExpandedRow = (
  row: Row<RendererVideo>,
  appState: AppState,
  setAppState: React.Dispatch<React.SetStateAction<AppState>>,
  persistentProgress: MutableRefObject<number>,
  stateManager: MutableRefObject<StateManager>
) => {
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
              <DungeonInfo video={row.original} />
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
const renderRow = (
  row: Row<RendererVideo>,
  selected: boolean,
  onRowClick: (row: Row<RendererVideo>) => void
) => {
  const selected = row.id === selectedRowId;

  return (
    <Fragment key={row.id}>
      {renderBaseRow(row, selected, onRowClick)}
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
