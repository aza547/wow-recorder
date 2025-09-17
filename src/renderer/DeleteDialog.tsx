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
  HTMLProps,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import CloudIcon from '@mui/icons-material/Cloud';
import SaveIcon from '@mui/icons-material/Save';
import { Phrase } from 'localisation/phrases';

type DeleteDialogProps = {
  children: React.ReactNode;
  inScope: RendererVideo[];
  appState: AppState;
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>;
  selectedRowCount: number;
};

const Checkbox = (props: HTMLProps<HTMLInputElement>) => {
  return (
    <input
      type="checkbox"
      className={'cursor-pointer accent-[#bb4420]'}
      {...props}
    />
  );
};

const DeleteDialog = ({
  children,
  inScope,
  appState,
  setVideoState,
  selectedRowCount,
}: DeleteDialogProps) => {
  const { language } = appState;

  // Alphabetically sort the videos by their name.
  const [data] = useState(() => [
    ...inScope.sort((a, b) => {
      return a.videoName.localeCompare(b.videoName);
    }),
  ]);

  const [rowSelection, setRowSelection] = useState({});

  // Initialize all the rows to be selected by default.
  useEffect(() => {
    const allRowIds = Object.fromEntries(data.map((_, i) => [i, true]));
    setRowSelection(allRowIds);
  }, [data]);

  const columns = useMemo<ColumnDef<RendererVideo>[]>(
    () => [
      {
        id: 'Select',
        cell: ({ row }) => (
          <div className="flex justify-center items-center">
            <Checkbox
              {...{
                checked: row.getIsSelected(),
                onChange: row.getToggleSelectedHandler(),
              }}
            />
          </div>
        ),
      },
      {
        id: 'Storage',
        accessorKey: 'cloud',
        cell: (info) => (
          <div className="flex justify-center items-center">
            {info.getValue() ? (
              <CloudIcon sx={{ height: 18, width: 18 }} />
            ) : (
              <SaveIcon sx={{ height: 18, width: 18 }} />
            )}
          </div>
        ),
      },
      {
        id: 'Name',
        accessorKey: 'videoName',
        // Strip date prefix from the video name.
        cell: (info) => (
          <div className="text-sm">{(info.getValue() as string).slice(22)}</div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });

  const renderTable = () => {
    return (
      <table>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell, index) => {
                let className = 'px-[4px] ';

                if (index === 2) {
                  className += 'text-left w-full'; // Take remaining space
                }

                return (
                  <td key={cell.id} className={className}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const getWarningMessage = () => {
    const warning = `${getLocalePhrase(
      language,
      Phrase.ThisWillPermanentlyDelete,
    )} ${table.getSelectedRowModel().rows.length} ${getLocalePhrase(
      language,
      Phrase.Recordings,
    )} ${getLocalePhrase(
      language,
      Phrase.From,
    )} ${Math.max(selectedRowCount, 1)} ${getLocalePhrase(language, Phrase.Rows)}.`;

    return <div className="text-sm">{warning}</div>;
  };

  const doDelete = () => {
    const toDelete = table
      .getSelectedRowModel()
      .rows.map((row) => row.original);

    window.electron.ipcRenderer.sendMessage('deleteVideos', toDelete);

    setVideoState((prev) => {
      return [...prev].filter((rv) => {
        return !toDelete.find(
          // A video is uniquely identified by its name and storage type.
          (v) => v.videoName === rv.videoName && v.cloud === rv.cloud,
        );
      });
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(appState.language, Phrase.AreYouSure)}
          </DialogTitle>
        </DialogHeader>
        {selectedRowCount < 2 && renderTable()}
        {getWarningMessage()}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">
              {getLocalePhrase(appState.language, Phrase.CancelTooltip)}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant="destructive"
              type="submit"
              onClick={doDelete}
              disabled={table.getSelectedRowModel().rows.length < 1}
            >
              {getLocalePhrase(appState.language, Phrase.DeleteButtonTooltip)}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteDialog;
