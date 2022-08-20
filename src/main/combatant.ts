/**
 * Represents an arena combatant.
 */
class Combatant {
    private _GUID: string;
    private _teamID: number;
    private _name?: string;

    /**
     * Constructs a new Combatant.
     * @param teamID the team the combatant belongs to.
     */
    constructor(GUID: string, teamID: number) {
        this._GUID = GUID;
        this._teamID = teamID;
    }

    /**
     * Gets the GUID.
     */
    get GUID() {
        return this._GUID;
    }
    
    /**
     * Sets the GUID.
     */
    set GUID(GUID) {
        this._GUID = GUID;
    }

    /**
     * Gets the team ID.
     */
    get teamID() {
        return this._teamID;
    }

    /**
     * Sets the team ID.
     */
    set teamID(value) {
        this._teamID = value;
    }
    
    /**
     * Gets the name.
     * @apinote Name is in Name-Realm format
     */
    get name() {
        return this._name;
    }

    /**
     * Sets the name.
     * @apinote Name is in Name-Realm format
     */
    set name(value) {
        this._name = value;
    }
}

export {
    Combatant
};