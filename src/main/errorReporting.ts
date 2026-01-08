import { BrowserWindow } from 'electron';
import { ErrorReport } from './types';

export const emitErrorReport = (data: unknown) => {
  console.error('[Util] Emitting error report', String(data));

  const report: ErrorReport = {
    date: new Date(),
    reason: String(data),
  };

  const windows = BrowserWindow.getAllWindows();
  if (!windows.length) return;

  windows.forEach((w) => {
    if (w.isDestroyed()) return;
    w.webContents.send('updateErrorReport', report);
  });
};

