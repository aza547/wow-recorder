import {
  IArenaMatch,
  IShuffleMatch,
  WoWCombatLogParser,
} from 'wow-combat-log-parser';

import path from 'path';
import Activity from '../activitys/Activity';
import ConfigService from '../main/ConfigService';

export default class WALHandler {
  private walParser: WoWCombatLogParser;

  private cfg: ConfigService = ConfigService.getInstance();

  private activity: Activity;

  constructor(activity: Activity) {
    this.walParser = new WoWCombatLogParser();
    this.register();
    this.activity = activity;
  }

  public parse(line: string) {
    this.walParser.parseLine(line);
  }

  public unregister() {
    this.walParser.removeAllListeners();
  }

  private register() {
    this.walParser
      .on('arena_match_ended', async (e: IArenaMatch) => {
        await this.updateMetadata(e);
      })
      .on('solo_shuffle_ended', async (e: IShuffleMatch) => {
        await this.updateMetadata(e);
      });
  }

  private async updateMetadata(e: IArenaMatch | IShuffleMatch) {
    const storagePath = this.cfg.get<string>('storagePath');
    const videoName = this.activity.getFileName();
    const metadataFile = path.join(storagePath, `${videoName}.json`);
    console.log('[WALHandler] Have WAL event for', metadataFile);
    // @@@ TODO actually update metadata
    // Need to wait on it to exist first? Recorder is going to create it but we don't know when currently
    // Maybe better to create it and then modify the recorder so it's updated rather than overwritten? 
  }
}
