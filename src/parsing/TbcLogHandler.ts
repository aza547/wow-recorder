import { tbcArenas, tbcBattlegrounds } from '../main/constants';
import { Flavour, NumberKeyToStringValueMapType } from '../main/types';
import ClassicLogHandler from './ClassicLogHandler';

/**
 * TBC Anniversary log handler class.
 *
 * Extends ClassicLogHandler, reusing all parsing logic (arena death tracking,
 * spec detection via spells/auras, combatant processing, etc.). Overrides the
 * flavour label and the arena/BG zone ID sets to TBC-specific values.
 *
 * Challenge Mode events are not registered here because TBC does not have M+.
 * The inherited listeners from ClassicLogHandler will never fire for those
 * events since the TBC combat log does not emit them.
 */
export default class TbcLogHandler extends ClassicLogHandler {
  protected override readonly flavour: Flavour = Flavour.Tbc;

  protected override readonly arenas: NumberKeyToStringValueMapType = tbcArenas;

  protected override readonly battlegrounds: NumberKeyToStringValueMapType =
    tbcBattlegrounds;

  constructor(logPath: string) {
    super(logPath);
  }
}
