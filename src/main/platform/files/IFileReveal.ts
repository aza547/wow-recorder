/**
 * Reveals a file in the platform's file manager, selecting it.
 * Windows: explorer.exe /select,<path>
 * macOS:   open -R <path>
 */
export interface IFileReveal {
  reveal(filePath: string): void;
}
