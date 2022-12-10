import { Metadata, PlayerDeathType, Flavour } from "main/types";
import { Combatant } from "../main/combatant";
import { VideoCategory } from "../main/constants";

/**
 * Abstract activity class.
 */
export default abstract class Activity {
    protected _category: VideoCategory;
    protected _result: boolean;
    protected _combatantMap: Map<string, Combatant>;
    protected _startDate: Date;
    protected _deaths: PlayerDeathType[];
    protected _flavour: Flavour;
    protected _endDate?: Date;
    protected _zoneID?: number;
    protected _playerGUID?: string;
    protected _overrun: number = 0;

    constructor(startDate: Date, 
                category: VideoCategory,
                flavour: Flavour) 
    {
        this._result = false;
        this._combatantMap = new Map();
        this._startDate = startDate;
        this._category = category;
        this._deaths = [];
        this._flavour = flavour;
    }
 
    abstract getMetadata(): Metadata;
    abstract getFileName(): string;

    get zoneID() { return this._zoneID };
    get category() { return this._category };
    get startDate() { return this._startDate };
    get result() { return this._result };
    get deaths() { return this._deaths };
    get playerGUID() { return this._playerGUID };
    get endDate() { return this._endDate };
    get combatantMap() { return this._combatantMap };
    get flavour() { return this._flavour };
    get overrun() { return this._overrun };
    set zoneID(zoneID) { this._zoneID = zoneID };
    set result(result) { this._result = result };
    set playerGUID(guid) { this._playerGUID = guid };
    set startDate(date) { this._startDate = date};
    set endDate(date) { this._endDate = date };
    set flavour(flavour) { this._flavour = flavour };
    set category(category) { this._category = category };
    set overrun(s) {this._overrun = s}

    get duration() { 
        if (!this.endDate) {
            throw new Error("Failed to get duration of in-progress activity");
        }

        return (this.endDate.getTime() - this.startDate.getTime()) / 1000;;
    };

    get player() {
        if (!this.playerGUID) {
            throw new Error("Failed to get player combatant, playerGUID not set");
        }

        const player = this.getCombatant(this.playerGUID);

        if (!player) {
            throw new Error("Player not found in combatants");
        }

        return player;
    }

    end(endDate: Date, result: boolean) {
        endDate.setSeconds(endDate.getSeconds() + this.overrun);
        this.endDate = endDate;
        this.result = result;
    }

    getCombatant(GUID: string) {
        return this.combatantMap.get(GUID);
    }

    addCombatant(combatant: Combatant) {
        this.combatantMap.set(combatant.GUID, combatant);
    }

    addDeath(death: PlayerDeathType) {
        this.deaths.push(death);
    }
}

