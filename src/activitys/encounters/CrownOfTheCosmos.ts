import { Flavour } from 'main/types';
import RaidEncounter from '../RaidEncounter';

export default class CrownOfTheCosmos extends RaidEncounter {
  public static encounterId = 3181;
  private static alleriaId = 244300;

  constructor(
    startDate: Date,
    encounterName: string,
    difficultyID: number,
    flavour: Flavour,
  ) {
    super(
      startDate,
      CrownOfTheCosmos.encounterId,
      encounterName,
      difficultyID,
      flavour,
    );

    this.bossUnitId = CrownOfTheCosmos.alleriaId;
  }
}
