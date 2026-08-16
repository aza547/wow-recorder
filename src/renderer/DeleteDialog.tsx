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
  CellContext,
} from '@tanstack/react-table';
import CloudIcon from '@mui/icons-material/Cloud';
import SaveIcon from '@mui/icons-material/Save';
import { Language, Phrase } from 'localisation/phrases';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import {
  getPlayerClass,
  getPlayerName,
  getPlayerSpecID,
  getVideoGroup,
  getVideoGroupIds,
  getWoWClassColor,
} from './rendererutils';
import { specImages } from './images';
import Box from '@mui/material/Box/Box';
import { LockKeyhole, LockOpen } from 'lucide-react';
import SelectAllShortcut from './components/Shortcuts/SelectAllShortcut';
import SelectRangeShortcut from './components/Shortcuts/SelectRangeShortcut';
import SelectMultiShortcut from './components/Shortcuts/SelectMultiShortcut';

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

  const previousVideoGroupIds = useRef(
    targetVideoIds.flatMap((id) => getVideoGroupIds(id, parentLookupMap)),
  );

  useEffect(() => {
    // If the target videos change (due to a remote delete) such that there
    // is no overlap with the previous selection, close the dialog to avoid
    // confusingly retargetting another video group.
    const currentVideoGroupIds = targetVideoIds.flatMap((id) =>
      getVideoGroupIds(id, parentLookupMap),
    );

    const overlap = currentVideoGroupIds.some((id) =>
      previousVideoGroupIds.current.includes(id),
    );

    if (open && !overlap) {
      onOpenChange(false);
    }

    previousVideoGroupIds.current = currentVideoGroupIds;
  }, [open, onOpenChange, targetVideoIds, parentLookupMap]);

  const populatePlayerCell = (
    info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const video = info.getValue() as RendererVideo;
    const { player } = video;

    if (!player || !player._specID) {
      return <div>Unknown</div>; // TODO localize
    }

    const playerClass = getPlayerClass(video);
    const playerSpecID = getPlayerSpecID(video);
    const playerName = getPlayerName(video);
    const playerClassColor = getWoWClassColor(playerClass);
    const specIcon = specImages[playerSpecID as keyof typeof specImages];

    const renderSpecAndName = () => {
      return (
        <div className="flex items-center pl-2 min-w-0">
          <Box
            component="img"
            src={specIcon}
            className="bg-background-higher shrink-0"
            sx={{
              height: '25px',
              width: '25px',
              border: '1px solid black',
              borderRadius: '15%',
              boxSizing: 'border-box',
              objectFit: 'cover',
            }}
          />

          <div
            className="font-sans font-semibold text-sm text-shadow-instance mx-1 truncate min-w-0"
            style={{ color: playerClassColor }}
          >
            {playerName}
          </div>
        </div>
      );
    };

    return <div className="flex truncate">{renderSpecAndName()}</div>;
  };

  const populateLockCell = (
    ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const video = ctx.getValue() as RendererVideo;
    const { isProtected } = video;

    const icon = isProtected ? (
      <LockKeyhole size={18} />
    ) : (
      <LockOpen size={18} />
    );

    return <div className="flex justify-center items-center">{icon}</div>;
  };

  const populateStorageCell = (
    ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const video = ctx.getValue() as RendererVideo;

    const icon = video.cloud ? (
      <CloudIcon sx={{ height: 18, width: 18 }} />
    ) : (
      <SaveIcon sx={{ height: 18, width: 18 }} />
    );

    return <div className="flex justify-center items-center">{icon}</div>;
  };

  const populateTagStatusCell = (
    ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const { row } = ctx;
    const { tag } = row.original;
    const text = tag ? tag : 'No custom tag.'; // TODO localise this text
    return <div className="truncate text-sm mx-2">{text}</div>;
  };

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
      cell: populatePlayerCell,
    },
    {
      id: 'Status',
      accessorFn: (v) => v,
      cell: (ctx) => populateTagStatusCell(ctx),
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

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [table]);

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
    const rowClassName = 'cursor-pointer hover:bg-secondary/80 ';
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
                        rowClassName +
                        (row.getIsSelected()
                          ? 'bg-secondary/100'
                          : idx % 2 === 0
                            ? 'bg-secondary/15'
                            : 'bg-secondary/40')
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
        : 'This selection contains no locked recordings.';

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
          {/* // TODO localize */}
          <DialogTitle>Delete</DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          {/* // TODO localize */}
          Deleting videos is permanent and cannot be undone.
        </div>
        {targetVideoIds.length === 1 && renderTable()}
        {getWarningMessage()}
        <DialogFooter>
          <DialogClose asChild>
            {/* // TODO localize */}
            <Button variant="ghost">Close</Button>
          </DialogClose>
          {/* // TODO localize */}
          <Button variant="destructive" onClick={doDelete} disabled={disabled}>
            Delete ({getVideosToDelete().length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteDialog;
