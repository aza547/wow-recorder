/**
 * Represents an arena combatant.
 */
class Combatant {
    private _teamID: string;
    private _name: string;

    /**
     * Constructs a new Combatant.
     * @param teamID the team the combatant belongs to.
     * @param name the name of the combatant.
     */
    constructor(teamID: string = "", name: string = "") {
        this._teamID = teamID;
        this._name = name;
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
     */
    get name() {
        return this._name;
    }

    /**
     * Sets the name.
     */
    set name(value) {
        this._name = value;
    }
}

export {
    Combatant
};