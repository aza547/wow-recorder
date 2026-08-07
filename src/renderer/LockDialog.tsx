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
  stockFeatures,
  useTable,
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
  lockDialogVideoTargetId: string | null;
  videoState: Array<RendererVideo>;
  setVideoState: Dispatch<SetStateAction<Array<RendererVideo>>>;
  language: Language;
  cloudStatus: CloudStatus;
}

export default function LockDialog(props: IProps) {
  const {
    open,
    setOpen,
    lockDialogVideoTargetId,
    videoState,
    setVideoState,
    language,
    cloudStatus,
  } = props;

  const setLock = (videos: Array<RendererVideo>, lock: boolean) => {
    const disk = videos.filter((v) => !v.cloud);
    const cloud = videos.filter((v) => v.cloud);

    ipc.sendMessage('videoButtonDisk', ['protect', lock, disk]);
    ipc.sendMessage('videoButtonCloud', ['protect', lock, cloud]);

    setVideoState((prev) => {
      return prev.map((rv) => {
        return videos.some((v) => v.uniqueId == rv.uniqueId)
          ? { ...rv, isProtected: lock }
          : rv;
      });
    });
  };

  const populateLockDialogLockCell = (
    ctx: CellContext<typeof stockFeatures, RendererVideo, unknown>,
    language: Language,
    cloudStatus: CloudStatus,
  ) => {
    const video = ctx.getValue() as RendererVideo;
    const { write, del } = cloudStatus;
    const { isProtected } = video;

    const noPermission =
      (!write && video.cloud) || (!del && video.cloud && isProtected);

    const icon = isProtected ? (
      <LockKeyhole size={18} />
    ) : (
      <LockOpen size={18} />
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
            onClick={(event) => {
              stopPropagation(event);
              setLock([video], !isProtected);
            }}
            disabled={noPermission}
          >
            {icon}
          </Button>
        </div>
      </Tooltip>
    );
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

  const populateLockedStatusCell = (
    info: CellContext<typeof stockFeatures, RendererVideo, unknown>,
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

  const columns: ColumnDef<typeof stockFeatures, RendererVideo, unknown>[] = [
    {
      id: 'Lock',
      accessorFn: (v) => v,
      cell: (ctx) => populateLockDialogLockCell(ctx, language, cloudStatus),
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
  ];

  const data = useMemo<Array<RendererVideo>>(() => {
    const parent = videoState.find(
      (v) => v.uniqueId === lockDialogVideoTargetId,
    );

    if (parent) {
      return [parent, ...parent.multiPov];
    }

    return [];
  }, [lockDialogVideoTargetId, videoState]);

  const table = useTable({
    columns,
    data,
    features: stockFeatures,
    getRowId: (row) => row.uniqueId,
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

  const renderLockAllButton = () => {
    const actionIsLock = data.some((v) => !v.isProtected);
    const includesCloud = data.some((v) => v.cloud);
    const label = actionIsLock ? 'Lock All' : 'Unlock All';
    const { write, del } = cloudStatus;
    const noPermission = includesCloud && (!write || (!del && !actionIsLock));

    return (
      <Button
        disabled={noPermission}
        onClick={(event) => {
          stopPropagation(event);
          setLock(data, actionIsLock);
        }}
      >
        {label}
      </Button>
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
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
          {renderLockAllButton()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
