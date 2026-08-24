import { CloudStatus, RendererVideo } from 'main/types';
import {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getLocalePhrase } from 'localisation/translations';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/Dialog/Dialog';
import { Button } from './components/Button/Button';
import { Language, Phrase } from 'localisation/phrases';
import { Textarea } from './components/TextArea/textarea';
import {
  ColumnDef,
  flexRender,
  Row,
  stockFeatures,
  useTable,
} from '@tanstack/react-table';
import { getVideoGroup } from './rendererutils';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import CircularProgress from '@mui/material/CircularProgress/CircularProgress';
import {
  populatePlayerCell,
  populateStorageCell,
  populateTagCell,
  populateTagStatusCell,
} from './components/Tables/Cells';

interface IProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetVideoId: string | null;
  parentLookupMap: Map<string, RendererVideo>;
  setVideoState: Dispatch<SetStateAction<Array<RendererVideo>>>;
  language: Language;
  cloudStatus: CloudStatus;
}

const ipc = window.electron.ipcRenderer;

export default function TagDialog(props: IProps) {
  const {
    open,
    onOpenChange,
    parentLookupMap,
    setVideoState,
    language,
    targetVideoId,
    cloudStatus,
  } = props;

  const { write } = cloudStatus;
  const [rowSelection, setRowSelection] = useState({});
  const [innerTag, setInnerTag] = useState<string>('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const debounceStartRef = useRef<number | null>(null);
  const debounceTimer = 2000;
  const [debounceProgress, setDebounceProgress] = useState<number | null>(null);

  const previousOpen = useRef(open);
  const previousParentId = useRef(targetVideoId);

  useEffect(() => {
    const openNotOpening = !open && !previousOpen.current;
    const group = getVideoGroup(targetVideoId, parentLookupMap);

    if (!openNotOpening && previousParentId.current !== targetVideoId) {
      // Close an open dialog if the parent video has been deleted by another
      // user. That should be rare enough that this isn't too annoying.
      onOpenChange(false);
    } else if (!openNotOpening && group.length < 1) {
      // Close an open dialog if it is now excluded by the filter. For example
      // a user with a tag filter removes a tag.
      onOpenChange(false);
    }

    previousParentId.current = targetVideoId;
    previousOpen.current = open;
  }, [onOpenChange, open, parentLookupMap, targetVideoId]);

  const saveTag = (video: RendererVideo, tag: string) => {
    if (video.cloud) {
      ipc.sendMessage('videoButtonCloud', ['tag', tag, [video]]);
    } else {
      ipc.sendMessage('videoButtonDisk', ['tag', tag, [video]]);
    }

    setVideoState((prev) =>
      prev.map((rv) => (rv.uniqueId === video.uniqueId ? { ...rv, tag } : rv)),
    );
  };

  const clearAllTags = () => {
    if (debounceRef.current) {
      clearInterval(debounceRef.current);
      debounceRef.current = null;
    }

    setDebounceProgress(null);

    const videos = table.getRowModel().rows.map((r) => r.original);
    const ids = videos.map((v) => v.uniqueId);
    const disk = videos.filter((v) => !v.cloud);
    const cloud = videos.filter((v) => v.cloud);

    ipc.sendMessage('videoButtonCloud', ['tag', '', cloud]);
    ipc.sendMessage('videoButtonDisk', ['tag', '', disk]);

    setInnerTag('');

    setVideoState((prev) => {
      return prev.map((rv) =>
        ids.includes(rv.uniqueId) ? { ...rv, tag: '' } : rv,
      );
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (debounceRef.current) {
      clearInterval(debounceRef.current);
      debounceRef.current = null;

      const selected = table.getSelectedRowModel().rows;
      const video = selected[0]?.original;

      if (video) {
        saveTag(video, innerTag);
      }
    }

    setDebounceProgress(null);
    onOpenChange(open);
  };

  const columns: ColumnDef<typeof stockFeatures, RendererVideo, unknown>[] = [
    {
      id: 'Tag',
      accessorFn: (v) => v,
      cell: (ctx) => populateTagCell(ctx),
    },
    {
      id: 'Storage',
      accessorFn: (v) => v,
      cell: (ctx) => populateStorageCell(ctx),
    },
    {
      id: 'Player',
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
    const group = getVideoGroup(targetVideoId, parentLookupMap);

    group.sort((a, b) => {
      const aName = a.player?._name ?? '';
      const bName = b.player?._name ?? '';
      return aName.localeCompare(bName);
    });

    return group;
  }, [parentLookupMap, targetVideoId]);

  const table = useTable({
    columns,
    data,
    features: stockFeatures,
    getRowId: (row) => row.uniqueId,
    enableRowSelection: true,
    state: { rowSelection },
    onRowSelectionChange: (newSelection) => {
      if (debounceRef.current) {
        clearInterval(debounceRef.current);
        debounceRef.current = null;

        const selected = table.getSelectedRowModel().rows;
        const video = selected[0]?.original;

        if (video) {
          saveTag(video, innerTag);
        }
      }

      setDebounceProgress(null);
      setRowSelection(newSelection);
    },
  });

  useEffect(() => {
    const selectedRows = table.getSelectedRowModel().rows;

    if (selectedRows.length > 0) {
      return;
    }

    if (data.length > 0) {
      setRowSelection({ [data[0].uniqueId]: true });
      setInnerTag(data[0]?.tag ?? '');
    }
  }, [data, table]);

  const onRowClick = (
    event: React.MouseEvent<HTMLTableRowElement> | KeyboardEvent,
    row: Row<typeof stockFeatures, RendererVideo>,
  ) => {
    const selectedRows = table.getSelectedRowModel().rows;

    selectedRows.forEach((r) => {
      if (r.id !== row.id) {
        r.getToggleSelectedHandler()(event);
      }
    });

    if (!row.getIsSelected()) {
      row.getToggleSelectedHandler()(event);
      setInnerTag(row.original.tag ?? '');
    }
  };

  const renderTable = () => {
    return (
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
                {table.getRowModel().rows.map((row, idx) => (
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
    );
  };

  const renderTextArea = () => {
    const selected = table.getSelectedRowModel().rows;
    const { write } = cloudStatus;

    let tooltip = getLocalePhrase(language, Phrase.TagButtonTooltip);
    let disabled = false;

    if (selected.length !== 1) {
      disabled = true;
    } else if (!write && selected[0].original.cloud) {
      disabled = true;
      tooltip = getLocalePhrase(language, Phrase.GuildNoPermission);
    }

    return (
      <div className="relative">
        <Textarea
          maxLength={1024}
          className="bg-background-dark-gradient-to rounded-sm h-20
                    border-background-dark-gradient-to flex-1 resize-none
                    placeholder:text-foreground focus-visible:ring-0
                    focus-visible:border-background-dark-gradient-to scrollbar-thin py-2"
          placeholder={tooltip}
          spellCheck={false}
          value={innerTag}
          disabled={disabled}
          onChange={(e) => {
            if (debounceRef.current) {
              clearInterval(debounceRef.current);
              debounceRef.current = null;
            }

            const tag = e.target.value;
            setInnerTag(tag);

            const selected = table.getSelectedRowModel().rows;
            const video = selected[0]?.original;

            if (!video) {
              return;
            }

            const startTime = Date.now();
            debounceStartRef.current = startTime;
            setDebounceProgress(0);

            debounceRef.current = setInterval(() => {
              const elapsed = Date.now() - startTime;
              const progress = (elapsed / debounceTimer) * 100;

              setDebounceProgress(progress);

              // Better UX to go a bit beyond 100% so that the user sees the
              // progress fill up completely before it disappears.
              if (progress < 125) {
                return;
              }

              if (debounceRef.current) {
                clearInterval(debounceRef.current);
                debounceRef.current = null;
              }

              debounceStartRef.current = null;
              setDebounceProgress(null);
              saveTag(video, tag);
            }, 100);
          }}
          onKeyDown={(e) => {
            // Need this to prevent "k" triggering video play/pause while
            // dialog is open and other similar things.
            e.stopPropagation();
          }}
        />
        {debounceProgress !== null && (
          <div className="absolute right-2 top-2">
            <CircularProgress
              variant="determinate"
              color="inherit"
              value={Math.min(debounceProgress, 100)}
              size={16}
            />
          </div>
        )}
      </div>
    );
  };

  const includesAnyCloud = table
    .getRowModel()
    .rows.some((r) => r.original.cloud);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(language, Phrase.TableHeaderTag)}
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          {getLocalePhrase(language, Phrase.TagDescription)}
        </div>
        {renderTable()}
        {renderTextArea()}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">
              {getLocalePhrase(language, Phrase.Close)}
            </Button>
          </DialogClose>
          <Button onClick={clearAllTags} disabled={includesAnyCloud && !write}>
            {getLocalePhrase(language, Phrase.ClearAll)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
