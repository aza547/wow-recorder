import { exec } from 'child_process';
import type { IFileReveal } from './IFileReveal';

/** Windows file reveal — opens Explorer with the file highlighted. */
export default class WinFileReveal implements IFileReveal {
  reveal(filePath: string): void {
    const windowsPath = filePath.replace(/\//g, '\\');
    const cmd = `explorer.exe /select,"${windowsPath}"`;
    exec(cmd, () => {});
  }
}
