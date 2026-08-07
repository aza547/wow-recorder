import { RendererVideo } from 'main/types';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
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
  getWoWClassColor,
} from './rendererutils';
import { specImages } from './images';
import Box from '@mui/material/Box/Box';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import { Cloud, Pen, PenLine, SaveIcon } from 'lucide-react';

interface IProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  tagDialogVideoTargetId: string | null;
  videoState: Array<RendererVideo>;
  setVideoState: Dispatch<SetStateAction<Array<RendererVideo>>>;
  language: Language;
}

export default function TagDialog(props: IProps) {
  const {
    open,
    setOpen,
    videoState,
    setVideoState,
    language,
    tagDialogVideoTargetId,
  } = props;

  const [tag, setTag] = useState('');
  const [rowSelection, setRowSelection] = useState({});

  // const handleOpenChange = (isOpen: boolean) => {
  //   setTagDialogVideoTarget(isOpen ? tagDialogVideoTarget : null);
  //   setTag(tag);
  // };

  const saveTag = (newTag: string) => {
    // const toProtectDisk = videos.filter((v) => !v.cloud);
    // const toProtectCloud = videos.filter((v) => v.cloud);
    // window.electron.ipcRenderer.sendMessage('videoButtonDisk', [
    //   'tag',
    //   newTag,
    //   toProtectDisk,
    // ]);
    // window.electron.ipcRenderer.sendMessage('videoButtonCloud', [
    //   'tag',
    //   newTag,
    //   toProtectCloud,
    // ]);
    // setVideoState((prev) => {
    //   const state = [...prev];
    //   state.forEach((rv) => {
    //     // A video is uniquely identified by its name and storage type.
    //     const match = videos.find(
    //       (v) => v.videoName === rv.videoName && v.cloud === rv.cloud,
    //     );
    //     if (match) {
    //       rv.tag = newTag;
    //     }
    //   });
    //   return state;
    // });
  };

  const clearTag = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    saveTag('');
  };

  const onSave = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    saveTag(tag ?? '');
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
        <>
          <Box
            key={player._GUID}
            component="img"
            src={specIcon}
            className="bg-background-higher"
            sx={{
              display: 'flex',
              height: '25px',
              width: '25px',
              border: '1px solid black',
              borderRadius: '15%',
              boxSizing: 'border-box',
              objectFit: 'cover',
            }}
          />
          <div
            className="font-sans font-semibold text-sm text-shadow-instance mx-1 truncate flex items-center"
            style={{ color: playerClassColor }}
          >
            {playerName}
          </div>
        </>
      );
    };

    return <div className="flex truncate">{renderSpecAndName()}</div>;
  };

  const populateTagCell = (
    ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const { row } = ctx;
    const { tag } = row.original;

    if (tag) {
      return <PenLine size={18} className="mx-2" />;
    }
    return <Pen size={18} className="mx-2" />;
  };

  const populateStorageCell = (
    ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const { row } = ctx;
    const { cloud } = row.original;

    if (cloud) {
      return <Cloud size={18} />;
    }
    return <SaveIcon size={18} />;
  };

  const populateTagStatusCell = (
    info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
  ) => {
    const { row } = info;
    const { tag } = row.original;

    if (tag) {
      return <div className=" truncate text-sm mr-2">{tag}</div>;
    }
    return <div className=" truncate text-sm">No custom tag</div>;
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
      accessorKey: 'encounterName',
      cell: (ctx) => populatePlayerCell(ctx),
    },
    {
      id: 'Status',
      accessorFn: (v) => v,
      accessorKey: 'encounterName',
      cell: (ctx) => populateTagStatusCell(ctx),
    },
  ];

  const data = useMemo<Array<RendererVideo>>(() => {
    const parent = videoState.find(
      (v) => v.uniqueId === tagDialogVideoTargetId,
    );
    return parent ? [parent, ...parent.multiPov] : [];
  }, [tagDialogVideoTargetId, videoState]);

  const table = useTable({
    columns,
    data,
    features: stockFeatures,
    getRowId: (row) => row.uniqueId,
    enableRowSelection: true,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });

  const renderTable = () => {
    const sorted = table.getRowModel().rows.sort((a, b) => {
      const aName = a.original.player?._name ?? '';
      const bName = b.original.player?._name ?? '';
      return aName.localeCompare(bName);
    });

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

      setTag(row.original.tag ?? '');
    };

    const rowClassName = 'cursor-pointer hover:bg-secondary/80 ';

    return (
      <div className="max-h-[300px] overflow-auto">
        <ScrollArea
          id={'asdasd'}
          withScrollIndicators={false}
          className="h-full w-full"
        >
          <div>
            <table className="table-fixed w-full mx-auto border-separate border-spacing-y-0 overflow-hidden rounded-sm">
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 150 }} />
                <col />
              </colgroup>
              <tbody>
                {sorted.map((row, idx) => (
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

  if (!open) {
    return <Dialog open={open} onOpenChange={setOpen}></Dialog>;
  }

  const renderTextArea = () => {
    const selected = table.getSelectedRowModel().rows;
    const tooltip =
      selected.length < 1
        ? 'Select a video to add a tag.'
        : getLocalePhrase(language, Phrase.TagButtonTooltip);

    return (
      <Textarea
        maxLength={1024}
        className="bg-background-dark-gradient-to rounded-sm h-20
                    border-background-dark-gradient-to flex-1 resize-none
                    placeholder:text-foreground  focus-visible:ring-0
                    focus-visible:border-background-dark-gradient-to scrollbar-thin py-2"
        placeholder={tooltip}
        spellCheck={false}
        value={tag}
        disabled={selected.length !== 1}
        onChange={(e) => setTag(e.target.value)}
        onKeyDown={(e) => {
          // Need this to prevent "k" triggering video play/pause while
          // dialog is open and other similar things.
          e.stopPropagation();
        }}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tag Manager</DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          Tags may be added to videos to label them for future reference. Tags
          are not used for any other purpose and do not affect the video.
        </div>
        {renderTable()}
        {renderTextArea()}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>

          <Button variant="ghost">Clear All</Button>
          <Button onClick={onSave} type="submit">
            {getLocalePhrase(language, Phrase.Save)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
