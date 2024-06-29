import { exec } from 'child_process';

export interface ProcessDescriptor {
  readonly caption: string;
  readonly pid: string;
}

const listProcesses = async (): Promise<ProcessDescriptor[]> => {
  const cmd = 'wmic process get Caption,ProcessId';

  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`, stderr);
        reject();
        return;
      }

      const processList = stdout
        .split('\n')
        .map((line) => line.trim().split(/\s+/))
        .filter((parts) => parts.length === 2)
        .map((parts) => ({ caption: parts[0], pid: parts[1] }));

      resolve(processList);
    });
  });
};

export default listProcesses;
