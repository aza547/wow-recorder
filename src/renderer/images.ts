import {
  dungeonsByZoneId,
  classicArenas,
  retailArenas,
  raidEncountersById,
  retailBattlegrounds,
  classicBattlegrounds,
  specializationById,
} from '../main/constants';

interface ImageObject {
  [id: number]: string;
}

const retailArenaIDs = Object.keys(retailArenas).map((v) => parseInt(v, 10));
const retailArenaImages: ImageObject = {};

retailArenaIDs.forEach((id) => {
  try {
    retailArenaImages[id] = require(`../../assets/arena/${id}.jpg`);
  } catch (e) {
    console.debug(
      `[Images] Unable to load image resource that was expected to exist.\n`,
      e
    );
  }
});

const classicArenaIDs = Object.keys(classicArenas).map((v) => parseInt(v, 10));
const classicArenaImages: ImageObject = {};

classicArenaIDs.forEach((id) => {
  try {
    classicArenaImages[id] = require(`../../assets/arena/${id}.jpg`);
  } catch (e) {
    console.debug(
      `[Images] Unable to load image resource that was expected to exist.\n`,
      e
    );
  }
});

const dungeonIDs = Object.keys(dungeonsByZoneId).map((v) => parseInt(v, 10));
const dungeonImages: ImageObject = {};

dungeonIDs.forEach((id) => {
  try {
    dungeonImages[id] = require(`../../assets/dungeon/${id}.jpg`);
  } catch (e) {
    console.debug(
      `[Images] Unable to load image resource that was expected to exist.\n`,
      e
    );
  }
});

const raidIDs = Object.keys(raidEncountersById).map((v) => parseInt(v, 10));
const raidImages: ImageObject = {};

raidIDs.forEach((id) => {
  try {
    raidImages[id] = require(`../../assets/raid/${id}.jpg`);
  } catch (e) {
    console.debug(
      `[Images] Unable to load image resource that was expected to exist.\n`,
      e
    );
  }
});

const retailBattlegroundIDs = Object.keys(retailBattlegrounds).map((v) =>
  parseInt(v, 10)
);
const retailBattlegroundImages: ImageObject = {};

retailBattlegroundIDs.forEach((id) => {
  try {
    retailBattlegroundImages[
      id
    ] = require(`../../assets/battlegrounds/${id}.jpg`);
  } catch (e) {
    console.error(
      `[Images] Unable to load image resource that was expected to exist.\n`,
      e
    );
  }
});

const classicBattlegroundIDs = Object.keys(classicBattlegrounds).map((v) =>
  parseInt(v, 10)
);
const classicBattlegroundImages: ImageObject = {};

classicBattlegroundIDs.forEach((id) => {
  try {
    classicBattlegroundImages[
      id
    ] = require(`../../assets/battlegrounds/${id}.jpg`);
  } catch (e) {
    console.error(
      `[Images] Unable to load image resource that was expected to exist.\n`,
      e
    );
  }
});

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

const arenaImages = {
  ...retailArenaImages,
  ...classicArenaImages,
};

const battlegroundImages = {
  ...retailBattlegroundImages,
  ...classicBattlegroundImages,
};

export {
  arenaImages,
  dungeonImages,
  raidImages,
  battlegroundImages,
  specImages,
};
