import { dungeonsByZoneId, classicArenas, retailArenas, raidEncountersById, retailBattlegrounds, classicBattlegrounds, specializationById } from '../main/constants'

interface imageObject {
    [id: number]: string;
}

const retailArenaIDs = Object.keys(retailArenas).map(v => parseInt(v, 10));
const retailArena: imageObject = {};

for (const id of retailArenaIDs) {
    try {
        retailArena[id] = require(`../../assets/arena/${id}.jpg`);
    }
    catch (e) {
        console.debug(`[Images] Unable to load image resource that was expected to exist.\n`, e)
    };
}

const classicArenaIDs = Object.keys(classicArenas).map(v => parseInt(v, 10));
const classicArena: imageObject = {};

for (const id of classicArenaIDs) {
    try {
        classicArena[id] = require(`../../assets/arena/${id}.jpg`);
    }
    catch (e) {
        console.debug(`[Images] Unable to load image resource that was expected to exist.\n`, e)
    };
}

const dungeonIDs = Object.keys(dungeonsByZoneId).map(v => parseInt(v, 10));
let dungeon: imageObject = {};

for (const id of dungeonIDs) {
    try {
        dungeon[id] = require(`../../assets/dungeon/${id}.jpg`);
    }
    catch (e) {
        console.debug(`[Images] Unable to load image resource that was expected to exist.\n`, e)
    };
}

const raidIDs = Object.keys(raidEncountersById).map(v => parseInt(v, 10));
const raid: imageObject = {};

for (const id of raidIDs) {
    try {
        raid[id] = require(`../../assets/raid/${id}.jpg`);
    }
    catch (e) {
        console.debug(`[Images] Unable to load image resource that was expected to exist.\n`, e)
    };
}

const retailBattlegroundIDs = Object.keys(retailBattlegrounds).map(v => parseInt(v, 10));
const retailBattlegroundImages: imageObject = {};

for (const id of retailBattlegroundIDs) {
    try {
        retailBattlegroundImages[id] = require(`../../assets/battlegrounds/${id}.jpg`);
    }
    catch (e) {
        console.error(`[Images] Unable to load image resource that was expected to exist.\n`, e)
    };
}

const classicBattlegroundIDs = Object.keys(classicBattlegrounds).map(v => parseInt(v, 10));
const classicBattlegroundImages: imageObject = {};

for (const id of classicBattlegroundIDs) {
    try {
        classicBattlegroundImages[id] = require(`../../assets/battlegrounds/${id}.jpg`);
    }
    catch (e) {
        console.error(`[Images] Unable to load image resource that was expected to exist.\n`, e)
    };
}

const specIDs = Object.keys(specializationById).map(v => parseInt(v, 10));
const spec: imageObject = { 
    0: require("../../assets/icon/wowNotFound.png") 
};

for (const id of specIDs) {
    try {
        spec[id] = require(`../../assets/specs/${id}.png`);
    }
    catch (e) {
        console.error(`[Images] Unable to load image resource that was expected to exist.\n`, e)
    };
}

const arena = {
    ...retailArena,
    ...classicArena,
}

const battleground = {
    ...retailBattlegrounds,
    ...classicBattlegrounds,
}

export {
    arena,
    dungeon,
    raid,
    battleground,
    spec
}