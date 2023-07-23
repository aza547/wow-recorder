import { dungeonAffixesById, specializationById } from '../main/constants';

import UnknownIcon from '../../assets/icon/wowNotFound.png';
import TankIcon from '../../assets/roles/tank.png';
import HealerIcon from '../../assets/roles/healer.png';
import DamageIcon from '../../assets/roles/damage.png';

interface ImageObject {
  [id: number]: string;
}

interface StrImageObject {
  [name: string]: string;
}

const specIDs = Object.keys(specializationById).map((v) => parseInt(v, 10));
const specImages: ImageObject = {
  0: UnknownIcon,
};

specIDs.forEach((id) => {
  try {
    specImages[id] = require(`../../assets/specs/${id}.png`);
  } catch (e) {
    console.error(
      `[Images] Unable to load image resource that was expected to exist.\n`,
      e
    );
  }
});

const affixIDs = Object.keys(dungeonAffixesById).map((v) => parseInt(v, 10));
const affixImages: ImageObject = {};

affixIDs.forEach((id) => {
  try {
    affixImages[id] = require(`../../assets/affixes/${id}.jpg`);
  } catch (e) {
    console.error(
      `[Images] Unable to load image resource that was expected to exist.\n`,
      e
    );
  }
});

const roleImages: StrImageObject = {
  tank: TankIcon,
  healer: HealerIcon,
  damage: DamageIcon,
};

const chestImage = require('../../assets/icon/chest.png');

export { specImages, affixImages, roleImages, chestImage };
