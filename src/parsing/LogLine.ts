/**
 * A just-in-time parsed line from the WoW combat log.
 *
 * The object is constructed from the original combat log line and will
 * parse log line arguments incrementally as they are requested.
 *
 * A log line like CHALLENGE_MODE_START which has few arguments won't see
 * much performance gain over parsing everything, but COMBATANT_INFO will
 * due to its absurdly long list of arguments that we most often won't use.
 */
export default class LogLine {
  // Current parsing position in the original line
  private _linePosition = 0;

  // Length of the original line to avoid reevaluating it
  // many times.
  private _lineLength = 0;

  // Multi-dimensional array of arguments
  // Example: 'ARENA_MATCH_START', '2547', '33', '2v2', '1'
  private _args: any[] = [];

  // Length of this.args to avoid evaluating this.args.length
  // may times.
  private _argsListLen = 0;

  // Timestamp in string format, as-is, from the log
  // Example: '8/3 22:09:58.548'
  public timestamp: string = '';

  constructor(public original: string) {
    this._lineLength = this.original.length;

    // Combat log line always has '<timestamp>  <line>' format,
    // that is, two spaces between ts and line.
    this._linePosition = this.original.indexOf('  ') + 2;
    this.timestamp = this.original.substring(0, this._linePosition - 2);

    // Parse the first argument, which is the event type and will always
    // be needed.
    this.parseLogArg(1);
  }

  arg(index: number): any {
    if (!this._args || index >= this._argsListLen) {
      const maxsplit = Math.max(index + 1, this._argsListLen);
      this.parseLogArg(maxsplit);
    }

    return this._args[index];
  }

  /**
   * Parse the timestamp from a log line and create a Date object from it.
   */
  date(): Date {
    const timeParts = this.timestamp.split(/[^0-9]/);
    const dateObj = new Date();

    if (timeParts.length >= 7) {
      // In TWW, Blizzard changed the timestamp format to include the year.
      // e.g. "7/27/2024 21:39:13.0951"
      const [month, day, year, hours, mins, secs] = timeParts.map((v) =>
        parseInt(v, 10)
      );

      dateObj.setMonth(month - 1);
      dateObj.setDate(day);
      dateObj.setFullYear(year);
      dateObj.setHours(hours);
      dateObj.setMinutes(mins);
      dateObj.setSeconds(secs);
      dateObj.setMilliseconds(0);
    } else {
      // Non-TWW timestamp, doesn't include year.
      // e.g. "4/9 20:04:44.359"
      const [month, day, hours, mins, secs] = timeParts.map((v) =>
        parseInt(v, 10)
      );

      dateObj.setMonth(month - 1);
      dateObj.setDate(day);
      dateObj.setHours(hours);
      dateObj.setMinutes(mins);
      dateObj.setSeconds(secs);
      dateObj.setMilliseconds(0);
    }

    return dateObj;
  }

  /**
   * Returns the combat log event type of the log line
   * E.g. `ENCOUNTER_START`.
   */
  type(): string {
    return this.arg(0);
  }

  /**
   * Splits a WoW combat line intelligently with respect to quotes,
   * lists, tuples, and what have we.
   *
   * @param maxSplits Maximum number of elements to find (same as `limit` for `string.split()` )
   */
  private parseLogArg(maxSplits?: number): void {
    // Array of items that has been parsedin the current scope of the parsing.
    //
    // This can end up being multidimensional in the case of some combat events
    // that have complex data stored, like `COMBATANT_INFO`.
    const listItems: any[] = [];

    let inQuotedString = false;
    let openListCount = 0;
    let value: any = '';

    for (
      this._linePosition;
      this._linePosition < this._lineLength;
      this._linePosition++
    ) {
      const char = this.original.charAt(this._linePosition);
      if (char === '\n') {
        break;
      }
      if (maxSplits && this._argsListLen >= maxSplits) {
        break;
      }

      if (inQuotedString) {
        if (char === '"') {
          inQuotedString = false;
          continue;
        }
      } else {
        switch (char) {
          case ',':
            if (openListCount > 0) {
              listItems.at(-1)?.push(value);
            } else {
              this.addArg(value);
            }

            value = '';
            continue;

          case '"':
            inQuotedString = true;
            continue;

          case '[':
          case '(':
            listItems.push([]);
            openListCount++;
            continue;

          case ']':
          case ')':
            if (!listItems.length) {
              throw new Error(`Unexpected ${char}. No list is open.`);
            }

            if (value) {
              listItems.at(-1)?.push(value);
            }

            value = listItems.pop();
            openListCount--;
            continue;

          default:
          // Linter is upset without a default case so now we have one.
        }
      }

      value += char;
    }

    if (value) {
      this.addArg(value);
    }

    if (openListCount > 0) {
      throw new Error(
        `Unexpected EOL. There are ${openListCount} open list(s).`
      );
    }
  }

  /**
   * Add an argument to the list
   */
  private addArg(value: any): void {
    this._args.push(value);
    this._argsListLen = this._args.length;
  }

  toString(): string {
    return this.original;
  }
}
