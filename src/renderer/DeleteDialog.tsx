import { AppState, RendererVideo } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/Dialog/Dialog';
import { Button } from './components/Button/Button';
import {
  Dispatch,
  ReactNode,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ColumnDef,
  flexRender,
  useTable,
  stockFeatures,
  Row,
} from '@tanstack/react-table';
import { Language, Phrase } from 'localisation/phrases';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import { getVideoGroup } from './rendererutils';
import SelectAllShortcut from './components/Shortcuts/SelectAllShortcut';
import SelectRangeShortcut from './components/Shortcuts/SelectRangeShortcut';
import SelectMultiShortcut from './components/Shortcuts/SelectMultiShortcut';
import {
  populateLockCell,
  populatePlayerCell,
  populateStorageCell,
  populateTagStatusCell,
} from './components/Tables/Cells';
import { isEqual } from 'lodash';

const ipc = window.electron.ipcRenderer;

type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  targetVideoIds: Array<string>;
  language: Language;
  parentLookupMap: Map<string, RendererVideo>;
  setVideoState: Dispatch<SetStateAction<Array<RendererVideo>>>;
  appState: AppState;
};

const DeleteDialog = (props: DeleteDialogProps) => {
  const {
    open,
    onOpenChange,
    language,
    targetVideoIds,
    parentLookupMap,
    setVideoState,
    children,
    appState,
  } = props;

  const { cloudStatus } = appState;
  const [rowSelection, setRowSelection] = useState({});

  const previousOpen = useRef(open);
  const previousParentIds = useRef(targetVideoIds);

  useEffect(() => {
    // Close an open dialog if any of the parent video has been deleted by
    // another user. That should be rare enough that this isn't too annoying.
    if (
      open &&
      previousOpen.current &&
      !isEqual(previousParentIds.current, targetVideoIds)
    ) {
      onOpenChange(false);
    }

    previousParentIds.current = targetVideoIds;
    previousOpen.current = open;
  }, [onOpenChange, open, targetVideoIds]);

  const columns: ColumnDef<typeof stockFeatures, RendererVideo, unknown>[] = [
    {
      id: 'Lock',
      accessorFn: (v) => v,
      cell: populateLockCell,
    },
    {
      id: 'Storage',
      accessorFn: (v) => v,
      cell: populateStorageCell,
    },
    {
      id: 'Name',
      accessorFn: (v) => v,
      cell: (ctx) => populatePlayerCell(ctx, language),
    },
    {
      id: 'Status',
      accessorFn: (v) => v,
      cell: (ctx) => populateTagStatusCell(ctx, language),
    },
  ];

  const data = useMemo<Array<RendererVideo>>(() => {
    const group = getVideoGroup(targetVideoIds[0], parentLookupMap);

    group.sort((a, b) => {
      const aName = a.player?._name ?? '';
      const bName = b.player?._name ?? '';
      return aName.localeCompare(bName);
    });

    return group;
  }, [targetVideoIds, parentLookupMap]);

  const table = useTable({
    columns,
    data,
    features: stockFeatures,
    getRowId: (row) => row.uniqueId,
    enableRowSelection: true,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });

  useEffect(() => {
    const selectedRows = table.getSelectedRowModel().rows;

    if (selectedRows.length > 0) {
      return;
    }

    if (data.length > 0) {
      setRowSelection({ [data[0].uniqueId]: true });
    }
  }, [data, table]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (event.key === 'a' && event.ctrlKey) {
        const { rows } = table.getRowModel();

        rows.forEach((row) => {
          if (!row.getIsSelected()) {
            row.getToggleSelectedHandler()(event);
          }
        });

        event.preventDefault();
        event.stopPropagation();
        return;
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, table]);

  const onRowClick = (
    event: React.MouseEvent<HTMLTableRowElement> | KeyboardEvent,
    row: Row<typeof stockFeatures, RendererVideo>,
  ) => {
    const rows = table.getRowModel().rows;
    const targetIndex = rows.findIndex((r) => r.id === row.id);
    const selectedRows = table.getSelectedRowModel().rows;

    if (event.shiftKey) {
      const baseIndex = selectedRows[0]
        ? rows.findIndex((r) => r.id === selectedRows[0].id)
        : 0;

      const start = Math.min(baseIndex, targetIndex);
      const end = Math.max(baseIndex, targetIndex) + 1;

      rows.slice(start, end).forEach((r) => {
        if (!r.getIsSelected()) {
          r.toggleSelected(true);
        }
      });

      return;
    }

    const isClickedRowOnlySelected =
      selectedRows.length === 1 && row.getIsSelected();

    if (event.ctrlKey && !isClickedRowOnlySelected) {
      row.getToggleSelectedHandler()(event);
      return;
    }

    selectedRows.forEach((r) => {
      if (r.id !== row.id) {
        r.getToggleSelectedHandler()(event);
      }
    });

    if (!row.getIsSelected()) {
      row.getToggleSelectedHandler()(event);
    }
  };

  const renderTable = () => {
    const { rows } = table.getRowModel();

    return (
      <>
        <div className="max-h-[300px] overflow-auto">
          <ScrollArea withScrollIndicators={false} className="h-full w-full">
            <div>
              <table className="table-fixed w-full mx-auto border-separate border-spacing-y-0 overflow-hidden rounded-sm">
                <colgroup>
                  <col style={{ width: 35 }} />
                  <col style={{ width: 35 }} />
                  <col style={{ width: 125 }} />
                  <col />
                </colgroup>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={
                        'cursor-pointer ' +
                        (row.getIsSelected()
                          ? 'bg-secondary/100'
                          : idx % 2 === 0
                            ? 'bg-secondary/15 hover:bg-secondary/80'
                            : 'bg-secondary/40 hover:bg-secondary/80')
                      }
                      onClick={(event) => onRowClick(event, row)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="h-[30px]">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </div>
        {rows.length > 1 && (
          <div className="flex gap-2 items-center">
            <SelectRangeShortcut language={language} />
            <SelectMultiShortcut language={language} />
            <SelectAllShortcut language={language} />
          </div>
        )}
      </>
    );
  };

  const getWarningMessage = () => {
    const videos = getVideosToDelete();
    const rows = targetVideoIds.length;

    const generalWarning = `${getLocalePhrase(
      language,
      Phrase.ThisWillPermanentlyDelete,
    )} ${videos.length} ${getLocalePhrase(
      language,
      Phrase.Recordings,
    )} ${getLocalePhrase(
      language,
      Phrase.From,
    )} ${rows} ${getLocalePhrase(language, Phrase.Rows)}.`;

    const locked = videos.filter((rv) => rv.isProtected);

    const lockWarning =
      locked.length > 0
        ? getLocalePhrase(language, Phrase.DeleteSelectionContainsLocked)
        : getLocalePhrase(language, Phrase.DeleteSelectionContainsNoLocked);

    const lockWarningColor = locked.length > 0 ? 'text-destructive' : '';

    // We don't render the table in this case so make the gap match the Dialog.
    const gap = targetVideoIds.length > 1 ? 'gap-4' : 'gap-2';

    return (
      <div className={`text-sm ${gap} flex flex-col h-[60px]`}>
        <p>{generalWarning}</p>
        <p className={lockWarningColor}>{lockWarning}</p>
      </div>
    );
  };

  const getVideosToDelete = () => {
    const multipleParentRowsSelected = targetVideoIds.length > 1;

    const toDelete = multipleParentRowsSelected
      ? targetVideoIds.flatMap((uniqueId) =>
          getVideoGroup(uniqueId, parentLookupMap),
        )
      : table.getSelectedRowModel().rows.map((row) => row.original);

    return toDelete;
  };

  const doDelete = () => {
    const toDelete = getVideosToDelete();

    const toDeleteDisk = toDelete.filter((rv) => !rv.cloud);
    const toDeleteCloud = toDelete.filter((rv) => rv.cloud);

    ipc.sendMessage('deleteVideosDisk', toDeleteDisk);
    ipc.sendMessage('deleteVideosCloud', toDeleteCloud);

    setVideoState((prev) => {
      return [...prev].filter((rv) => {
        return !toDelete.find((v) => v.uniqueId === rv.uniqueId);
      });
    });

    onOpenChange(false);
  };

  // Don't really expect this to happen as we don't allow the delete dialog to
  // open in the case of no permission, but there are edge cases like a user
  // opens the delete dialog and then an uploaded video is added while open.
  const { del } = cloudStatus;
  const noPermission = !del && getVideosToDelete().some((v) => v.cloud);
  const disabled = getVideosToDelete().length < 1 || noPermission;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(language, Phrase.DeleteButtonTooltip)}
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          {getLocalePhrase(language, Phrase.DeleteIsPermanent)}
        </div>
        {targetVideoIds.length === 1 && renderTable()}
        {getWarningMessage()}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">
              {getLocalePhrase(language, Phrase.Close)}
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={doDelete} disabled={disabled}>
            {getLocalePhrase(language, Phrase.DeleteButtonTooltip)} (
            {getVideosToDelete().length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteDialog;
