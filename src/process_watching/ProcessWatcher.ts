/* eslint global-require: off, no-console: off, promise/always-return: off */
import { EventEmitter } from "stream";
import { wowExecutableFlavours }  from '../data/constants';
import { IWoWProcessResult } from '../main/types';
import { tasklist } from 'tasklist';
import ConfigService from '../config_service/ConfigService';

class ProcessWatcher extends EventEmitter {

    private _wowProcessRunning: IWoWProcessResult | null = null;
    private _pollWowProcessInterval: NodeJS.Timer;
    private _cfg = ConfigService.getInstance();

    /**
     * constructor
     */
    constructor() {
        super();
    }

    /**
     * start
     */
    private start() {
        // If we've re-called this we need to reset the current state of process 
        // tracking. This is important for settings updates. 
        this.resetProcessTracking();

        // Run a check without waiting for the timeout. 
        this.pollWoWProcessLogic();

        if (this._pollWowProcessInterval) {
            clearInterval(this._pollWowProcessInterval);
        }

        this._pollWowProcessInterval = setInterval(this.pollWoWProcessLogic, 5000);
    }

    /**
     * 
     */
    private resetProcessTracking() {
        this._wowProcessRunning = null;
    }

    /**
     * Check Windows task list and find any WoW process.
     */
    private async checkWoWProcess(): Promise<IWoWProcessResult[]> {
        const wowProcessRx = new RegExp(/(wow(T|B|classic)?)\.exe/, 'i');
        const taskList = await tasklist();

        return taskList
            // Map all processes found to check if they match `wowProcessRx`
            .map((p: any) => p.imageName.match(wowProcessRx))
            // Remove those that result in `null` (didn't match)
            .filter((p: any) => p)
            // Return an object suitable for `IWoWProcessResult`
            .map((match: any): IWoWProcessResult => ({
                exe: match[0],
                flavour: wowExecutableFlavours[match[1].toLowerCase()]
            }))
        ;
    }

    /**
     * pollWoWProcessLogic
     */
     private async pollWoWProcessLogic() {
        const wowProcesses = await this.checkWoWProcess();
        const processesToRecord = wowProcesses.filter(this.filterFlavoursByConfig);
        const firstProcessToRecord = processesToRecord.pop();

        if ((this._wowProcessRunning === null) && firstProcessToRecord) {
            this.emit("started")
        } else if (this._wowProcessRunning !== null && !firstProcessToRecord) {
            this.emit("stopped")
        }
    }

    /**
     * Filter out flavours that we are not configured to record. 
     */
    private filterFlavoursByConfig(wowProcess: IWoWProcessResult) {
        const wowFlavour = wowProcess.flavour;

        const recordClassic = this._cfg.get<boolean>("recordClassic");
        const recordRetail = this._cfg.get<boolean>("recordRetail");

        // Any non classic flavour is considered a retail flavour (i.e. retail, beta, ptr)
        const validRetailProcess = (wowFlavour !== "Classic" && recordRetail);
        const validClassicProcess = (wowFlavour === "Classic" && recordClassic);

        if (validRetailProcess || validClassicProcess) {
            return true;
        }
        
        return false;
    }
}

export {
    ProcessWatcher,
}