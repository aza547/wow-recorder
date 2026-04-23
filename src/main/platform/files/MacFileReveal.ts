import { spawn } from 'child_process';
import type { IFileReveal } from './IFileReveal';

/**
 * macOS file reveal — opens Finder with the file selected via `open -R`.
 * `spawn` (not `exec`) avoids shell quoting concerns with paths that
 * contain spaces or special characters.
 */
export default class MacFileReveal implements IFileReveal {
  reveal(filePath: string): void {
    spawn('open', ['-R', filePath]);
  }
}
