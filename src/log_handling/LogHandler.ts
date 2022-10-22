import { categoryRecordingSettings, VideoCategory }  from '../main/constants';
import { UnitFlags, Metadata, EndRecordingOptionsType } from '../main/types';
import { Recorder } from '../recorder/recorder';
import ConfigService from '../main/configService';

class LogHandler {
    protected _recorder: Recorder;
    protected _recordingStartDate: Date | null = null;
    protected _recordingStopDate: Date | null = null;
    protected _metadata: Metadata | null = null;
    protected _currentActivity: VideoCategory | null = null;
    protected _cfg = ConfigService.getInstance();

    /**
     * Constructor
     */
    constructor(recorder: Recorder) {
        this._recorder = recorder;
    };

    /**
     * startRecording
     */
    startRecording = (category: VideoCategory) => {
        if (!this.allowRecordCategory(category)) {
            console.info("[LogUtils] Not configured to record", category);
            return;
        } else if (this._recorder.isRecording || !this._recorder.isRecordingBuffer) {
            console.error("[LogUtils] Avoiding error by not attempting to start recording",
                            this._recorder.isRecording,
                            this._recorder.isRecordingBuffer);
            return;
        }

        console.log(`[Logutils] Start recording a video for category: ${category}`)

        // Ensure combatant map and player combatant is clean before
        // starting a new recording.
        // clearCombatants();

        this._currentActivity = category;
        this._recorder.start();
    }
        
    /**
     * endRecording
     */
    endRecording = (options?: EndRecordingOptionsType) => {
        if (!this._recorder.isRecording || !this._currentActivity) {
            console.error("[LogUtils] Avoiding error by not attempting to stop recording");
            return;
        }

        if (!this._recordingStopDate) {
            this._recordingStopDate = new Date();
        }

        const overrun = categoryRecordingSettings[this._currentActivity].videoOverrun;
        const videoDuration = (this._recordingStopDate.getTime() - this._recordingStartDate.getTime());
        const closedWow = options?.closedWow ?? false;

        this._metadata.duration = Math.round(videoDuration / 1000) + overrun;
        this._metadata.result = options?.result ?? false;

        console.log(`[Logutils] Stop recording video for category: ${this._currentActivity}`)

        this._recorder.stop(this._metadata, overrun, closedWow);
        this._currentActivity = null;
    }

    /**
     * Check and return whether we're allowed to record a certain type of content
     */
    allowRecordCategory = (category: VideoCategory): boolean => {
        const categoryConfig = categoryRecordingSettings[category];
        const configKey = categoryConfig.configKey;
        const categoryAllowed = this._cfg.get<boolean>(configKey);

        if (!categoryAllowed) {
            console.log("[Logutils] Configured to not record", category);
            return false;
        };

        return true;
    };

    /**
     * Split name and realm. Name stolen from:
     * https://wowpedia.fandom.com/wiki/API_Ambiguate
     * @param nameRealm string containing name and realm
     * @returns array containing name and realm
     */
    ambiguate = (nameRealm: string): string[] => {
        const split = nameRealm.split("-");
        const name = split[0];
        const realm = split[1];
        return [name, realm];
    }

    /**
     * Determine if the unit is a player.
     *
     * See more here: https://wowpedia.fandom.com/wiki/UnitFlag
     */
     isUnitPlayer = (flags: number): boolean => {
        return (
            this.hasFlag(flags, UnitFlags.CONTROL_PLAYER) &&
            this.hasFlag(flags, UnitFlags.TYPE_PLAYER)
        );
    }
    
    /**
     * Return whether the bitmask `flags` contain the bitmask `flag`
     */
    hasFlag = (flags: number, flag: number): boolean => {
        return (flags & flag) !== 0;
    }

    /**
     * Determine if the `flags` value indicate our own unit.
     * This is determined by the unit being a player and having the
     * flags `AFFILIATION_MINE` and `REACTION_FRIENDLY`.
     */
    isUnitSelf = (flags: number): boolean => {
        return this.isUnitPlayer(flags) && (
            this.hasFlag(flags, UnitFlags.REACTION_FRIENDLY) &&
            this.hasFlag(flags, UnitFlags.AFFILIATION_MINE)
        );
    }
}

export {
    LogHandler,
}