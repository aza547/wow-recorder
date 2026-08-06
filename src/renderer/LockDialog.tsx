import { CloudStatus, RendererVideo } from 'main/types';
import { Dispatch, SetStateAction, useMemo } from 'react';
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
import {
  CellContext,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import {
  getPlayerClass,
  getPlayerName,
  getPlayerSpecID,
  getWoWClassColor,
  stopPropagation,
} from './rendererutils';
import { specImages } from './images';
import Box from '@mui/material/Box/Box';
import { Cloud, LockKeyhole, LockOpen, SaveIcon } from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { Tooltip } from './components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

interface IProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  lockDialogVideoTarget: RendererVideo | null;
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>;
  language: Language;
  cloudStatus: CloudStatus;
}

export default function LockDialog(props: IProps) {
  const {
    open,
    setOpen,
    lockDialogVideoTarget,
    setVideoState,
    language,
    cloudStatus,
  } = props;

  const populateLockDialogLockCell = (
    ctx: CellContext<RendererVideo, unknown>,
    language: Language,
    cloudStatus: CloudStatus,
    setVideoState: Dispatch<SetStateAction<RendererVideo[]>>,
  ) => {
    const video = ctx.getValue() as RendererVideo;
    const { write, del } = cloudStatus;
    const { isProtected } = video;

    const noPermission =
      (!write && video.cloud) || (!del && video.cloud && isProtected);

    const toggleProtected = (e: React.MouseEvent<HTMLButtonElement>) => {
      stopPropagation(e);

      if (video.cloud) {
        ipc.sendMessage('videoButtonCloud', ['protect', !isProtected, [video]]);
      } else {
        ipc.sendMessage('videoButtonDisk', ['protect', !isProtected, [video]]);
      }

      setVideoState((prev) => {
        return prev.map((rv) => {
          return video.uniqueId == rv.uniqueId
            ? { ...rv, isProtected: !isProtected }
            : rv;
        });
      });
    };

    const icon = isProtected ? (
      <LockKeyhole size={20} />
    ) : (
      <LockOpen size={20} />
    );

    let tooltip = '';

    if (noPermission) {
      tooltip = getLocalePhrase(language, Phrase.GuildNoPermission);
    } else if (!isProtected) {
      tooltip = getLocalePhrase(language, Phrase.StarSelected);
    } else {
      tooltip = getLocalePhrase(language, Phrase.UnstarSelected);
    }

    return (
      <Tooltip content={tooltip}>
        <div>
          <Button
            variant="ghost"
            size="xs"
            onClick={toggleProtected}
            disabled={noPermission}
          >
            {icon}
          </Button>
        </div>
      </Tooltip>
    );
  };

  const populateStorageCell = (ctx: CellContext<RendererVideo, unknown>) => {
    const { row } = ctx;
    const { cloud } = row.original;

    if (cloud) {
      return <Cloud size={20} />;
    }
    return <SaveIcon size={20} />;
  };

  const populatePlayerCell = (info: CellContext<RendererVideo, unknown>) => {
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

  const populateLockedStatusCell = (
    info: CellContext<RendererVideo, unknown>,
  ) => {
    const { row } = info;
    const { isProtected } = row.original;

    if (isProtected) {
      return (
        <div className="flex truncate text-sm">
          Safe from automatic deletion
        </div>
      );
    }
    return (
      <div className="flex truncate text-sm">
        Eligible for automatic deletion
      </div>
    );
  };

  const columns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Lock',
        accessorFn: (v) => v,
        cell: (ctx) =>
          populateLockDialogLockCell(ctx, language, cloudStatus, setVideoState),
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
        cell: (ctx) => populateLockedStatusCell(ctx),
      },
    ],
    [cloudStatus, language, setVideoState],
  );

  const data = useMemo<Array<RendererVideo>>(() => {
    return lockDialogVideoTarget
      ? [lockDialogVideoTarget, ...lockDialogVideoTarget.multiPov]
      : [];
  }, [lockDialogVideoTarget]);

  const table = useReactTable({
    columns,
    data,
    getRowId: (row) => row.uniqueId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const renderTable = () => {
    const sorted = table.getRowModel().rows.sort((a, b) => {
      const aName = a.original.player?._name ?? '';
      const bName = b.original.player?._name ?? '';
      return aName.localeCompare(bName);
    });

    return (
      <div className="max-h-[400px] overflow-auto">
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
                      idx % 2 === 0 ? 'bg-secondary/15' : 'bg-secondary/50'
                    }
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lock Manager</DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          Locked videos are protected from automatic deletion. Unlocked videos
          may be automatically deleted to make space for new videos.
        </div>
        {renderTable()}
        <DialogFooter>
          <Button>Lock/Unlock All</Button>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
