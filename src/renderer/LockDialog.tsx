import { RendererVideo } from 'main/types';
import { Dispatch, SetStateAction, useMemo, useState } from 'react';
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
import { Language, Phrase } from 'localisation/phrases';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  populateLockCell,
  populateLockedStatusCell,
  populatePlayerCell,
  populateStorageCell,
} from './components/Tables/Cells';
import { DetailsHeader } from './components/Tables/Headers';

interface IProps {
  videos: Array<RendererVideo>;
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>;
  children: React.ReactNode;
  language: Language;
}

export default function LockDialog(props: IProps) {
  const { videos, setVideoState, children, language } = props;
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const columns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Lock',
        accessorFn: (v) => v,
        cell: (ctx) => populateLockCell(ctx),
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
    [],
  );

  const table = useReactTable({
    columns,
    data: videos,
    getRowId: (row) => row.uniqueId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const renderTable = () => {
    return (
      <table className="table-fixed w-full mx-auto border-separate border-spacing-y-0 overflow-hidden rounded-sm">
        <colgroup>
          <col style={{ width: 35 }} />
          <col style={{ width: 35 }} />
          <col style={{ width: 150 }} />
          <col />
        </colgroup>
        <tbody>
          {table.getRowModel().rows.map((row, idx) => (
            <tr
              key={row.id}
              className={idx % 2 === 0 ? 'bg-secondary/15' : 'bg-secondary/50'}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-2 h-[30px]">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lock Manager</DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          Locked videos are protected from automatic deletion. Unlocked videos
          may be automatically deleted to make space for new videos.
        </div>
        <div>{renderTable()}</div>

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
