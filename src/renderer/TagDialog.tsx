import { RendererVideo } from 'main/types';
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
  CellContext,
  ColumnDef,
  flexRender,
  Row,
  stockFeatures,
  useTable,
} from '@tanstack/react-table';
import {
  getPlayerClass,
  getPlayerName,
  getPlayerSpecID,
  getVideoGroup,
  getWoWClassColor,
} from './rendererutils';
import { specImages } from './images';
import Box from '@mui/material/Box/Box';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import { MessageSquare, MessageSquareMore } from 'lucide-react';
import SaveIcon from '@mui/icons-material/Save';
import CloudIcon from '@mui/icons-material/Cloud';
import CircularProgress from '@mui/material/CircularProgress/CircularProgress';

interface IProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetVideoId: string | null;
  parentLookupMap: Map<string, RendererVideo>;
  setVideoState: Dispatch<SetStateAction<Array<RendererVideo>>>;
  language: Language;
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
  } = props;

  const [rowSelection, setRowSelection] = useState({});
  const [innerTag, setInnerTag] = useState<string>('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const debounceStartRef = useRef<number | null>(null);
  const debounceTimer = 2000;
  const [debounceProgress, setDebounceProgress] = useState<number | null>(null);

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

  const populatePlayerCell = (
    info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const video = info.getValue() as RendererVideo;
    const { player } = video;

    if (!player || !player._specID) {
      return <div>Unknown</div>;
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

  const populateTagCell = (
    ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const { row } = ctx;
    const { tag } = row.original;

    const icon = tag ? (
      <MessageSquareMore size={18} />
    ) : (
      <MessageSquare size={18} />
    );

    return <div className="flex justify-center items-center">{icon}</div>;
  };

  const populateStorageCell = (
    ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const { row } = ctx;
    const { cloud } = row.original;

    const icon = cloud ? (
      <CloudIcon
        sx={{
          height: '18px',
          width: '18px',
          color: 'white',
          opacity: 0.3,
          marginBottom: '3px',
        }}
      />
    ) : (
      <SaveIcon
        sx={{
          height: '18px',
          width: '18px',
          color: 'white',
          opacity: 0.3,
          marginBottom: '3px',
        }}
      />
    );

    return <div className="flex justify-center items-center">{icon}</div>;
  };

  const populateTagStatusCell = (
    info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const { row } = info;
    const { tag } = row.original;
    const text = tag ? tag : 'No custom tag.'; // TODO localise this text
    return <div className="truncate text-sm mx-2">{text}</div>;
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
      cell: (ctx) => populatePlayerCell(ctx),
    },
    {
      id: 'Status',
      accessorFn: (v) => v,
      cell: (ctx) => populateTagStatusCell(ctx),
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
    }

    setInnerTag(row.original.tag ?? '');
  };

  const renderTable = () => {
    const rowClassName = 'cursor-pointer hover:bg-secondary/80 ';

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
    );
  };

  const renderTextArea = () => {
    const selected = table.getSelectedRowModel().rows;
    const tooltip = getLocalePhrase(language, Phrase.TagButtonTooltip);

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
          disabled={selected.length !== 1}
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
              value={debounceProgress > 100 ? 100 : debounceProgress}
              size={16}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          {/* // TODO localize */}
          <DialogTitle>Tag</DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          {/* // TODO localize */}
          Tags may be added to videos to label them for future reference. Tags
          are not used for any other purpose and do not affect the video.
        </div>
        {renderTable()}
        {renderTextArea()}
        <DialogFooter>
          <DialogClose asChild>
            {/* // TODO localize */}
            <Button variant="ghost">Close</Button>
          </DialogClose>
          {/* // TODO localize */}
          <Button onClick={clearAllTags}>Clear All</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
