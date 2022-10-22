/**
 * Represents an arena combatant.
 */
class Combatant {
    private _GUID: string;
    private _teamID: number;
    private _specID: number;
    private _name?: string;
    private _realm?: string;

    /**
     * Constructs a new Combatant.
     * @param teamID the team the combatant belongs to.
     */
    constructor(GUID: string, teamID: number, specID: number) {
        this._GUID = GUID;
        this._teamID = teamID;
        this._specID = specID;
    }

    /**
     * Gets the GUID.
     */
    get GUID() {
        return this._GUID;
    }

    /**
     * Gets the team ID.
     */
    get teamID() {
        return this._teamID;
    }

    /**
     * Gets the team ID.
     */
    get specID() {
        return this._specID;
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

    /**
     * Gets the name.
     * @apinote Name is in Name-Realm format
     */
        get realm() {
        return this._realm;
    }
    
    /**
     * Sets the name.
     * @apinote Name is in Name-Realm format
     */
    set realm(value) {
        this._realm = value;
    }
}

export {
    Combatant
};