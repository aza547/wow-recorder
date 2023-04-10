import { RawCombatant } from "./types";

/**
 * Represents an arena combatant.
 */
export default class Combatant {
  private _GUID: string;

  private _teamID?: number;

  private _specID?: number;

  private _name?: string;

  private _realm?: string;

  /**
   * Constructs a new Combatant.
   *
   * @param GUID the GUID of the combatant.
   * @param teamID the team the combatant belongs to.
   * @param specID the specID of the combatant
   */
  constructor(GUID: string, teamID?: number, specID?: number) {
    this._GUID = GUID;

    if (teamID !== undefined) {
      this._teamID = teamID;
    }

    if (specID !== undefined) {
      this._specID = specID;
    }
  }

  /**
   * Gets the GUID.
   */
  get GUID() {
    return this._GUID;
  }

  /**
   * Sets the specID.
   */
  set GUID(value) {
    this._GUID = value;
  }

  /**
   * Gets the team ID.
   */
  get teamID() {
    return this._teamID;
  }

  /**
   * Sets the teamID.
   */
  set teamID(value) {
    this._teamID = value;
  }

  /**
   * Gets the team ID.
   */
  get specID() {
    return this._specID;
  }

  /**
   * Sets the specID.
   */
  set specID(value) {
    this._specID = value;
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

  isFullyDefined() {
    const hasGUID = this.teamID !== undefined;
    const hasName = this.name !== undefined;
    const hasRealm = this.realm !== undefined;
    const hasSpecID = this.specID !== undefined;
    const hasTeamID = this.teamID !== undefined;
    return hasGUID && hasName && hasRealm && hasSpecID && hasTeamID;
  }

  getRaw(): RawCombatant {
    const rawCombatant: RawCombatant = {};

    if (this.GUID !== undefined) rawCombatant._GUID = this.GUID;
    if (this.teamID !== undefined) rawCombatant._teamID = this.teamID;
    if (this.specID !== undefined) rawCombatant._specID = this.specID;
    if (this.name !== undefined) rawCombatant._name = this.name;
    if (this.realm !== undefined) rawCombatant._realm = this.realm;

    return rawCombatant;
  }
}
