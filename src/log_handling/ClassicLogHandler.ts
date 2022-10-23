import { CombatLogParser, LogLine } from "../main/combatLogParser";
import { Recorder } from "../main/recorder";
import LogHandler from "./LogHandler";

export default class RetailLogHandler extends LogHandler {
    
    constructor(recorder: Recorder, combatLogParser: CombatLogParser) {
        super(recorder, combatLogParser);
    }
}

