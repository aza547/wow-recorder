import { UnitFlags } from '../main/types';

export const hasFlag = (flags: number, flag: number) => {
  return (flags & flag) !== 0;
};

export const isUnitFriendly = (flags: number) => {
  return hasFlag(flags, UnitFlags.REACTION_FRIENDLY);
};

export const isUnitSelf = (flags: number) => {
  const isFriendly = hasFlag(flags, UnitFlags.REACTION_FRIENDLY);
  const isMine = hasFlag(flags, UnitFlags.AFFILIATION_MINE);
  return isFriendly && isMine;
};

export const isUnitPlayer = (flags: number) => {
  const isPlayerControlled = hasFlag(flags, UnitFlags.CONTROL_PLAYER);
  const isPlayerType = hasFlag(flags, UnitFlags.TYPE_PLAYER);
  return isPlayerControlled && isPlayerType;
};

export const ambiguate = (nameRealm: string): string[] => {
  const split = nameRealm.split('-');
  const name = split[0];
  const realm = split[1];
  const region = split[3];
  return [name, realm, region];
};
