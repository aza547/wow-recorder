import { dungeonAffixesById, specializationById } from '../main/constants';

interface ImageObject {
  [id: number]: string;
}

interface StrImageObject {
  [name: string]: string;
}

const specIDs = Object.keys(specializationById).map((v) => parseInt(v, 10));
const specImages: ImageObject = {
  0: require('../../assets/icon/wowNotFound.png'),
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
  tank: require('../../assets/roles/tank.png'),
  healer: require('../../assets/roles/healer.png'),
  damage: require('../../assets/roles/damage.png'),
};

const chestImage = require('../../assets/icon/chest.png');

export { specImages, affixImages, roleImages, chestImage };
