/**
 * Linux-specific WoW process detection.
 * Scans /proc filesystem for Wine/Proton processes running WoW executables.
 */

import { promises as fs } from 'fs';
import path from 'path';
import EventEmitter from 'events';

// WoW executable names to detect
const WOW_RETAIL_EXECUTABLES = ['Wow.exe', 'WowT.exe', 'WowB.exe'];
const WOW_CLASSIC_EXECUTABLES = ['WowClassic.exe', 'WowClassicT.exe'];
const ALL_WOW_EXECUTABLES = [...WOW_RETAIL_EXECUTABLES, ...WOW_CLASSIC_EXECUTABLES];

export interface ProcessDetectorResult {
  Retail: boolean;
  Classic: boolean;
}

/**
 * Reads the command line of a process from /proc/[pid]/cmdline.
 * Returns null if the process doesn't exist or can't be read.
 */
async function readProcessCmdline(pid: string): Promise<string | null> {
  try {
    const cmdlinePath = path.join('/proc', pid, 'cmdline');
    const content = await fs.readFile(cmdlinePath, 'utf-8');
    return content.replace(/\0/g, ' ').trim();
  } catch {
    // Process may have exited or we don't have permission
    return null;
  }
}

/**
 * Checks if a command line indicates a Wine/Proton process running WoW.
 * Wine processes typically have the executable name in the cmdline.
 */
function isWowProcess(cmdline: string): { isRetail: boolean; isClassic: boolean } {
  const cmdlineLower = cmdline.toLowerCase();

  const isWineProcess = cmdlineLower.includes('wine') ||
                        cmdlineLower.includes('proton') ||
                        cmdlineLower.includes('.exe');

  if (!isWineProcess) {
    return { isRetail: false, isClassic: false };
  }

  const isRetail = WOW_RETAIL_EXECUTABLES.some(exe =>
    cmdlineLower.includes(exe.toLowerCase())
  );

  const isClassic = WOW_CLASSIC_EXECUTABLES.some(exe =>
    cmdlineLower.includes(exe.toLowerCase())
  );

  return { isRetail, isClassic };
}

/**
 * Scans all processes in /proc to find WoW instances.
 */
export async function detectWowProcesses(): Promise<ProcessDetectorResult> {
  let retailFound = false;
  let classicFound = false;

  try {
    const entries = await fs.readdir('/proc');

    // Filter to only numeric directories (PIDs)
    const pids = entries.filter(entry => /^\d+$/.test(entry));

    const checks = pids.map(async (pid) => {
      const cmdline = await readProcessCmdline(pid);
      if (cmdline) {
        const { isRetail, isClassic } = isWowProcess(cmdline);
        if (isRetail) retailFound = true;
        if (isClassic) classicFound = true;
      }
    });

    await Promise.all(checks);
  } catch (error) {
    console.error('[LinuxProcessDetector] Error scanning /proc:', error);
  }

  return {
    Retail: retailFound,
    Classic: classicFound,
  };
}

/**
 * Linux process detector class that mimics the interface expected by Poller.
 * Periodically scans /proc and emits results.
 */
export class LinuxProcessDetector extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private pollInterval: number;

  constructor(pollIntervalMs: number = 1000) {
    super();
    this.pollInterval = pollIntervalMs;
  }

  /**
   * Start polling for WoW processes.
   */
  start(): void {
    if (this.intervalId) {
      this.stop();
    }

    console.info('[LinuxProcessDetector] Starting process polling');

    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.pollInterval);
  }

  /**
   * Stop polling.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.info('[LinuxProcessDetector] Stopped process polling');
    }
  }

  /**
   * Perform a single poll and emit the result.
   */
  private async poll(): Promise<void> {
    try {
      const result = await detectWowProcesses();
      this.emit('data', JSON.stringify(result));
    } catch (error) {
      this.emit('error', error);
    }
  }
}

export default LinuxProcessDetector;
