import { Combatant } from './Combatant';
import { recorder }  from '../main/main';
import { VideoCategory }  from '../data/constants';
import { LogLine } from './LogLine';
import { LogHandler } from './LogHandler';
import { Recorder } from '../recorder/recorder';

class RetailLogHandler extends LogHandler {
    private _playerCombatant;
    private _activeChallengeMode;
    private _combatantMap: Map<string, Combatant> = new Map();

    /**
     * Constructor
     */
    constructor(recorder: Recorder) {
        super(recorder);
    };

    /**
     * Passes the line to the appropriate handler.
     */
    handleLine(line: LogLine): void {
        const event = line.type();

        switch(event) {
            case "ARENA_MATCH_START":
                this.handleArenaMatchStart(line);
                break;
            case "ARENA_MATCH_END":
                this.handleArenaMatchStop(line);
                break
        }
    }

    /**
     * Handle a line from the WoW log.
     */
     handleArenaMatchStart(line: LogLine): void {
        if (this._recorder.isRecording) return;
        const category = (line.arg(3) as VideoCategory);

        const zoneID = parseInt(line.arg(1), 10);

        // If all goes to plan we don't need this but we do it incase the game
        // crashes etc. so we can still get a reasonable duration.
        this._recordingStartDate = line.date();

        this._metadata = {
            name: "name",
            category: category,
            zoneID: zoneID,
            duration: 0,
            result: false,
            playerDeaths: []
        }

        this.startRecording(category);
    }

    /**
     * Handle a line from the WoW log.
     */
    handleArenaMatchStop (line: LogLine): void {
        if (!recorder.isRecording) return;

        this._recordingStopDate = line.date();
        
        const [result, MMR] = this.determineArenaMatchResult(line); 
        this._metadata.teamMMR = MMR;

        this.endRecording({result});
    }

    /**
     * Determines the arena match result.
     * @param line the line from the WoW log.
     * @returns [win: boolean, newRating: number]
     */
    determineArenaMatchResult = (line: LogLine): any[] => {
        if (this._playerCombatant === undefined) return [undefined, undefined];
        const teamID = this._playerCombatant.teamID;
        const indexForMMR = (teamID == 0) ? 3 : 4;
        const MMR = parseInt(line.arg(indexForMMR), 10);
        const winningTeamID = parseInt(line.arg(1), 10);
        const win = (teamID === winningTeamID)
        return [win, MMR];
    }

    /**
     * Handles the SPELL_AURA_APPLIED line from WoW log.
     * @param line the SPELL_AURA_APPLIED line
     */
    handleSpellAuraAppliedLine (line: LogLine): void {
        if (this._playerCombatant) return;
        if (this._combatantMap.size === 0) return;

        const srcGUID = line.arg(1);
        const srcNameRealm = line.arg(2)
        const srcFlags = parseInt(line.arg(3), 16);

        const srcCombatant = this._combatantMap.get(srcGUID);
        if (srcCombatant === undefined) return;

        if (this.isUnitSelf(srcFlags)) {
            const [srcName, srcRealm] = this.ambiguate(srcNameRealm);
            srcCombatant.name = srcName;
            srcCombatant.realm = srcRealm;
            this._playerCombatant = srcCombatant;

            this.metadata.playerName = this._playerCombatant.name;
            this.metadata.playerRealm = this._playerCombatant.realm;
            this.metadata.playerSpecID = this._playerCombatant.specID;
        }
    }

    /**
     * Handles the COMBATANT_INFO line from WoW log by creating a Combatant and
     * adding it to combatantMap.
     * @param line the COMBATANT_INFO line
     */
    handleCombatantInfoLine (line: LogLine): void {
        const GUID = line.arg(1);
        const teamID = parseInt(line.arg(2), 10);
        const specID = parseInt(line.arg(24), 10);
        let combatantInfo = new Combatant(GUID, teamID, specID);
        this._combatantMap.set(GUID, combatantInfo);
    }

    /**
     * Return a combatant by guid, if it exists.
     */
    getCombatantByGuid(guid: string): Combatant | undefined {
        return this._combatantMap.get(guid);
    }

    /**
     * Clear combatants map and the current player combatant, if any.
     */
    clearCombatants = () => {
        this._combatantMap.clear();
        this._playerCombatant = undefined;
    }
}

export {
    RetailLogHandler,
}