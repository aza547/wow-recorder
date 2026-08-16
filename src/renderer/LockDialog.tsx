import { CloudStatus, RendererVideo } from 'main/types';
import { Dispatch, SetStateAction, useEffect, useMemo, useRef } from 'react';
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
  ColumnDef,
  flexRender,
  stockFeatures,
  useTable,
} from '@tanstack/react-table';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import {
  getVideoGroup,
  getVideoGroupIds,
  stopPropagation,
} from './rendererutils';
import { getLocalePhrase } from 'localisation/translations';
import LockButton from './components/Tables/LockButton';
import {
  populateLockedStatusCell,
  populatePlayerCell,
  populateStorageCell,
} from './components/Tables/Cells';

const ipc = window.electron.ipcRenderer;

interface IProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetVideoId: string | null;
  parentLookupMap: Map<string, RendererVideo>;
  setVideoState: Dispatch<SetStateAction<Array<RendererVideo>>>;
  language: Language;
  cloudStatus: CloudStatus;
}

export default function LockDialog(props: IProps) {
  const {
    open,
    onOpenChange,
    targetVideoId,
    parentLookupMap,
    setVideoState,
    language,
    cloudStatus,
  } = props;

  const previousOpen = useRef(open);

  const previousVideoGroupIds = useRef(
    getVideoGroupIds(targetVideoId, parentLookupMap),
  );

  useEffect(() => {
    // If the target videos change (due to a remote delete) such that there
    // is no overlap with the previous selection, close the dialog to avoid
    // confusingly retargetting another video group.
    const currentVideoGroupIds = getVideoGroupIds(
      targetVideoId,
      parentLookupMap,
    );

    const overlap = currentVideoGroupIds.some((id) =>
      previousVideoGroupIds.current.includes(id),
    );

    if (open && previousOpen.current && !overlap) {
      onOpenChange(false);
    }

    previousVideoGroupIds.current = currentVideoGroupIds;
    previousOpen.current = open;
  }, [onOpenChange, open, parentLookupMap, targetVideoId]);

  const setLock = (targets: Array<RendererVideo>, lock: boolean) => {
    const disk = targets.filter((v) => !v.cloud);
    const cloud = targets.filter((v) => v.cloud);

    ipc.sendMessage('videoButtonDisk', ['protect', lock, disk]);
    ipc.sendMessage('videoButtonCloud', ['protect', lock, cloud]);

    setVideoState((prev) => {
      return prev.map((rv) => {
        return targets.some((target) => rv.uniqueId === target.uniqueId)
          ? { ...rv, isProtected: lock }
          : rv;
      });
    });
  };

  const columns: ColumnDef<typeof stockFeatures, RendererVideo, unknown>[] = [
    {
      id: 'Lock',
      accessorFn: (v) => v,
      cell: (ctx) => (
        <LockButton
          parent={ctx.row.original}
          language={language}
          cloudStatus={cloudStatus}
          setVideoState={setVideoState}
        />
      ),
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
      cell: (ctx) => populateLockedStatusCell(ctx, language),
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
  });

  const renderTable = () => {
    const sorted = table.getRowModel().rows.sort((a, b) => {
      const aName = a.original.player?._name ?? '';
      const bName = b.original.player?._name ?? '';
      return aName.localeCompare(bName);
    });

    return (
      <div className="max-h-[400px] overflow-auto">
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

    const label = actionIsLock
      ? getLocalePhrase(language, Phrase.LockAll)
      : getLocalePhrase(language, Phrase.UnlockAll);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getLocalePhrase(language, Phrase.Lock)}</DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          {getLocalePhrase(language, Phrase.LockedDescription)}
        </div>
        {renderTable()}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">
              {getLocalePhrase(language, Phrase.Close)}
            </Button>
          </DialogClose>
          {renderLockAllButton()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
