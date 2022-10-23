import { ConfigurationSchemaKey } from "./configSchema";
import { NumberKeyToStringValueMapType, RaidInstanceType } from "./types";

enum VideoCategory {
  TwoVTwo = '2v2',
  ThreeVThree = '3v3',
  Skirmish = 'Skirmish',
  SoloShuffle = 'Solo Shuffle',
  MythicPlus = 'Mythic+',
  Raids = 'Raids',
  Battlegrounds = 'Battlegrounds',
};

const categories: VideoCategory[] = [
  VideoCategory.TwoVTwo,
  VideoCategory.ThreeVThree,
  VideoCategory.Skirmish,
  VideoCategory.SoloShuffle,
  VideoCategory.MythicPlus,
  VideoCategory.Raids,
  VideoCategory.Battlegrounds,
];

interface ICategoryRecordingSettings {
  configKey: ConfigurationSchemaKey,
  videoOverrun: number,
};

/**
 * Category specific settings for recording
 *
 * `configKey`:    The configuration key name that specifies if we're allowed
 *                 to record content from that particular category.
 *
 * `videoOverrun`: Number of seconds of how long to keep recording after an
 *                 activity ends to ensure we don't miss any important stuff
 *                  at the end.
 */
const categoryRecordingSettings: { [key in VideoCategory]: ICategoryRecordingSettings } = {
  [VideoCategory.TwoVTwo]: {
    configKey: 'recordTwoVTwo',
    videoOverrun: 3,
  },
  [VideoCategory.ThreeVThree]: {
    configKey: 'recordThreeVThree',
    videoOverrun: 3,
  },
  [VideoCategory.Skirmish]: {
    configKey: 'recordSkirmish',
    videoOverrun: 3,
  },
  [VideoCategory.SoloShuffle]: {
    configKey: 'recordSoloShuffle',
    videoOverrun: 3,
  },
  [VideoCategory.MythicPlus]:{
    configKey: 'recordDungeons',
    videoOverrun: 5, // For the whole dungeon
  },
  [VideoCategory.Raids]: {
    configKey: 'recordRaids',
    videoOverrun: 15, // Per boss encounter
  },
  [VideoCategory.Battlegrounds]: {
    configKey: 'recordBattlegrounds',
    videoOverrun: 3,
  },
};

/**
 * Months of the year.
 */
const months: string[] = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];

/**
 * Battlegrounds by ID. 
 */
 const battlegrounds: NumberKeyToStringValueMapType = {
  30:	  "Alterac Valley",
  2107: "Arathi Basin",
  1681: "Arathi Basin",
  1105: "Deepwind Gorge",
  2245: "Deepwind Gorge",
  566:  "Eye of the Storm",
  968:  "Eye of the Storm",
  628:  "Isle of Conquest",
  1803: "Seething Shore",
  727:  "Silvershard Mines",
  //607:  "Strand of the Ancients",
  998:  "Temple of Kotmogu",
  761:  "The Battle for Gilneas",
  726:  "Twin Peaks",
  489:  "Warsong Gulch",
  2106:  "Warsong Gulch"
}

/**
 * Arenas by ID. 
 */
 const arenas: NumberKeyToStringValueMapType = {
  1672: "Blade's Edge",
  617: "Dalaran Sewers",
  1505: "Nagrand Arena",
  572: "Ruins of Lordaeron",
  2167: "The Robodrome",
  1134: "Tiger's Peak",
  980: "Tol'Viron",
  1504: "Black Rook Hold",
  2373: "Empyrean Domain",
  1552: "Ashamane's Fall",
  1911: "Mugambala",
  1825: "Hook Point",
  2509: "Maldraxxus Coliseum",
  2547: "Enigma Crucible",
}

/**
 * Shadowlands Tier 1
 */
 const encountersNathria: NumberKeyToStringValueMapType = {
  2398: "Shriekwing",
  2418: "Huntsman",
  2402: "Sun King",
  2405: "Xy'mox",
  2383: "Hungering",
  2406: "Inerva",
  2412: "Council",
  2399: "Sludgefist",
  2417: "SLG",
  2407: "Denathrius"
}

/**
 * Shadowlands Tier 2
 */
const encountersSanctum: NumberKeyToStringValueMapType = {
  2523: "The Tarragrue",
  2433: "Jailer's Eye",
  2429: "The Nine",
  2432: "Ner'zhul",
  2434: "Souldrender",
  2430: "Painsmith",
  2436: "Guardian",
  2431: "Fatescribe",
  2422: "Kel'Thuzad",
  2435: "Sylvanas",
}

/**
 * Shadowlands Tier 3
 */
 const encountersSepulcher: NumberKeyToStringValueMapType = {
  2537: "Jailer",
  2512: "Guardian",
  2529: "Halondrus",
  2539: "Lihuvim",
  2540: "Dausegne",
  2542: "Skolex",
  2543: "Lords",
  2544: "Pantheon",
  2546: "Anduin",
  2549: "Rygelon",
  2553: "Xy'mox",
}

/**
 * Dragonflight Tier 1
 */
const encountersVOI: NumberKeyToStringValueMapType = {
  2587: "Eranog",
  2639: "Terros",
  2590: "Primal",
  2592: "Sennarth",
  2635: "Dathea",
  2605: "Kurog",
  2614: "Diurna",
  2607: "Raszageth",
}

/**
 * WOTLK Classic Naxxrammas
 */
 const encountersClassicNaxxramas: NumberKeyToStringValueMapType = {
  1107: "Anub'Rekhan",
  1110: "Faerlina",
  1116: "Maexxna",
  1118: "Patchwerk",
  1117: "Noth",
  1112: "Heigan",
  1115: "Lotheb",
  1113: "Razuvious",
  1109: "Gothik",
  1121: "Horsemen",
  1119: "Sapphiron",
  1120: "Thaddius",
  1114: "Kel'Thuzad",
  1111: "Grobbulus",
  1108: "Gluth",
}

/**
 * WOTLK Classic Eye of Eternity
 */
 const encountersClassicEye: NumberKeyToStringValueMapType = {
  734: "Malygos",
}

/**
 * WOTLK Classic Obsidian Sanctum
 */
 const encountersClassicObsidian: NumberKeyToStringValueMapType = {
  742: "Sartharion",
}

/**
 * WOTLK Classic Vault of Archavon
 */
 const encountersClassicVault: NumberKeyToStringValueMapType = {
  772: "Archavon",
}


const raidEncountersById: NumberKeyToStringValueMapType = {
  ...encountersNathria,
  ...encountersSanctum,
  ...encountersSepulcher,
  ...encountersVOI,
  ...encountersClassicNaxxramas,
  ...encountersClassicEye,
  ...encountersClassicObsidian,
  ...encountersClassicVault,
}

/**
 * List of raids and their encounters
 * This is used to figure out the raid name of a given encounter as that
 * information is not available in `ENCOUNTER_START` and we shouldn't and
 * can't rely on `ZONE_CHANGE` for this.
 */
const raidInstances: RaidInstanceType[] = [
  { zoneId: 13224, name: 'Castle Nathria', encounters: encountersNathria },
  { zoneId: 13561, name: 'Sanctum of Domination', encounters: encountersSanctum },
  { zoneId: 13742, name: 'Sepulcher of the First Ones', encounters: encountersSepulcher },
  { zoneId: 14030, name: 'Vault of the Incarnates', encounters: encountersVOI },
  { zoneId: 3456, name: 'Naxxramas', encounters: encountersClassicNaxxramas },
  { zoneId: 4500, name: 'Eye of Eternity', encounters: encountersClassicEye },
  { zoneId: 4493, name: 'Obsidian Sanctum', encounters: encountersClassicObsidian },
  { zoneId: 4603, name: 'Vault of Archavon', encounters: encountersClassicVault },
];

/**
 * Dungeons by zone ID.
 */
const dungeonsByZoneId: NumberKeyToStringValueMapType = {
  1651: 'Return to Karazhan',
  1208: 'Grimrail Depot',
  1195: 'Iron Docks',
  2097: "Operation: Mechagon",
  2291: "De Other Side",
  2287: "Halls of Atonement",
  2290: "Mists of Tirna Scithe",
  2289: "Plaguefall",
  2284: "Sanguine Depths",
  2285: "Spires of Ascension",
  2286: "The Necrotic Wake",
  2293: "Theater of Pain",
  2441: "Tazavesh the Veiled Market",
}

/**
 * Dungeons by map Id
 * Names have been shortened, or abbreviated due to size constraints in
 * <VideoButton/>
 */
const dungeonsByMapId: NumberKeyToStringValueMapType = {
  166: 'Grimrail Depot',
  169: 'Iron Docks',
  206: 'Neltharion\'s Lair',
  227: 'Karazhan: Lower',
  234: 'Karazhan: Upper',
  369: 'Mechagon: Junkyard',
  370: 'Mechagon: Workshop',
  375: 'Mists of Tirna Scithe',
  376: 'The Necrotic Wake',
  377: 'De Other Side',
  378: 'Halls of Atonement',
  379: 'Plaguefall',
  380: 'Sanguine Depths',
  381: 'Spires of Ascension',
  382: 'Theater of Pain',
  391: 'Tazavesh: Streets',
  392: 'Tazavesh: Gambit',
}

/**
 * Alloted time for Mythic Keystone dungeons, in seconds, the format of:
 *
 * mapId: [3 chest, 2 chest, 1 chest]
 *
 * The last one is obviously also the one the determines if a key was timed or not.
 *
 * Tip: It's easier to keep them as a calculation here, for comparison when Blizzard
 * occasionally adjusts timers for a dungeon.
 */
const dungeonTimersByMapId: { [id: number]: number[]; } = {
  206: [(40 * 60), (40 * 60), (40 * 60)],
  377: [(43 * 60), (34 * 60) + 25, (25 * 60) + 49],
  378: [(32 * 60), (25 * 60) + 36, (19 * 60) + 12],
  375: [(30 * 60), (24 * 60), (18 * 60)],
  379: [(38 * 60), (30 * 60) + 24, (22 * 60) + 38],
  380: [(41 * 60), (32 * 60) + 48, (24 * 60) + 36],
  381: [(39 * 60), (31 * 60) + 12, (23 * 60) + 24],
  376: [(36 * 60), (28 * 60) + 48, (21 * 60) + 36],
  382: [(38 * 60), (30 * 60) + 24, (22 * 60) + 38],
  227: [(42 * 60), (33 * 60) + 36, (25 * 60) + 12],
  234: [(35 * 60), (28 * 60), (21 * 60)],
  369: [(38 * 60), (30 * 60) + 24, (22 * 60) + 38],
  370: [(32 * 60), (25 * 60) + 36, (19 * 60) + 12],
  391: [(39 * 60), (31 * 60) + 12, (23 * 60) + 24],
  392: [(30 * 60), (24 * 60), (18 * 60)],
  169: [(30 * 60), (24 * 60), (18 * 60)],
  166: [(30 * 60), (24 * 60), (18 * 60)],
}

const dungeonEncounters: NumberKeyToStringValueMapType = {
  // Grimrail Depot
  1715: 'Rocketspark and Borka',
  1732: 'Nitrogg Thundertower',
  1736: 'Skylord Tovra',

  // Iron Docks
  1748: 'Grimrail Enforcers',
  1749: "Fleshrender Nok'gar",
  1750: 'Oshir',
  1754: 'Skulloc, Son of Gruul',

  // Nelthairon's Lair
  1790: 'Rokmora',
  1791: 'Ularogg Cragshaper',
  1792: 'Naraxas',
  1793: 'Dargrul the Underking',

  // Return to Karazhan: Lower
  1954: 'Maiden of Virtue',
  1957: 'Opera Hall',
  1960: 'Attumen the Huntsman',
  1961: 'Moroes',

  // Return to Karazhan: Upper
  1964: 'The Curator',
  1959: 'Mana Devourer',
  1965: 'Shade of Medivh',
  2017: "Viz'aduum the Watcher",

  // Mechagon: Workshop
  2257: 'Tussle Tonks',
  2258: 'K.U.-J.0.',
  2259: "Machinist's Garden",
  2260: 'King Mechagon',

  // Mechagon: Junkyard
  2290: 'King Gobbamak',
  2291: 'HK-8 Aerial Oppression Unit',
  2292: 'Gunker',
  2312: 'Trixie & Naeno',

  // Spires of Ascension
  2356: 'Ventunax',
  2357: 'Kin-Tara',
  2358: 'Oryphrion',
  2359: 'Devos, Paragon of Loyalty',

  // Sanguine Depths
  2360: 'Kryxis the Voracious',
  2361: 'Executor Tarvold',
  2362: 'Grand Proctor Beryllia',
  2363: 'General Kaal',

  // Theater of Pain
  2364: "Kul'tharok",
  2365: 'Gorechop',
  2366: 'Xav the Unfallen',
  2391: 'An Affront of Challengers',
  2404: 'Mordretha',

  // Halls of Atonement
  2380: 'Echelon',
  2381: 'Lord Chamberlain',
  2401: 'Halkias, the Sin-Stained Goliath',
  2403: 'High Adjudicator Aleez',

  // Plaguefall
  2382: 'Globgrog',
  2384: 'Doctor Ickus',
  2385: 'Domina Venomblade',
  2386: 'Stradama Margrave',

  // Necrotic Wake
  2387: 'Blightbone',
  2388: 'Amarth, The Harvester',
  2389: 'Surgeon Stitchflesh',
  2390: 'Nalthor the Rimebinder',

  // De Other Side
  2394: 'The Manastorms',
  2395: 'Hakkar, the Soulflayer',
  2396: "Mueh'zala",
  2400: "Dealer Xy'exa",

  // Mists of Tirna Scithe
  2397: 'Ingra Maloch',
  2392: 'Mistcaller',
  2393: "Tred'ova",

  // Tazavesh: So'leah's Gambit
  2419: "Timecap'n Hooktail",
  2426: 'Hylbrande',
  2442: "So'leah",

  // Tazavesh: Streets of Wonder
  2424: 'Mailroom Mayhem',
  2425: "Zo'phex the Sentinel",
  2441: 'The Grand Menagerie',
  2437: "So'azmi",
  2440: "Myza's Oasis",
};

const instanceNamesByZoneId: NumberKeyToStringValueMapType = {
  ...battlegrounds,
  ...arenas,
  ...dungeonsByZoneId,
};

const dungeonAffixesById: NumberKeyToStringValueMapType = {
    1: 'Overflowing',
    2: 'Skittish',
    3: 'Volcanic',
    4: 'Necrotic',
    6: 'Raging',
    7: 'Bolstering',
    8: 'Sanguine',
    9: 'Tyrannical',
    10: 'Fortified',
    11: 'Bursting',
    12: 'Grievous',
    13: 'Explosive',
    14: 'Quaking',
    122: 'Inspiring',
    117: 'Reaping',
    124: 'Storming',
    123: 'Spiteful',

    // Seasonal
    120: 'Awakened',

    // Seasonal, Shadowlands
    121: 'Prideful',   // Season 1
    128: 'Tormented',  // Season 2
    130: 'Encrypted',  // Season 3
    131: 'Shrouded',   // Season 4
};

/**
 * Zones by ID. 
 */
const zones: NumberKeyToStringValueMapType = {
    ...arenas,
    ...raidEncountersById,
    ...battlegrounds,
    ...dungeonsByZoneId,
}

const instanceEncountersById: NumberKeyToStringValueMapType = {
  ...raidEncountersById,
  ...dungeonEncounters,
};

type InstanceDifficultyPartyType = 'party' | 'raid' | 'pvp'
type ImstanceDifficultyIdType = 'lfr' | 'normal' | 'heroic' | 'mythic' | 'pvp'
type InstanceDifficultyType = {
    difficultyId: ImstanceDifficultyIdType,
    difficulty: string,
    partyType: InstanceDifficultyPartyType,
};
type InstanceDifficultyObjectType = {
  [key: number]: InstanceDifficultyType
};

const instanceDifficulty: InstanceDifficultyObjectType = {
  1: { difficultyId: 'normal', difficulty: 'N', partyType: 'party' },
  2: { difficultyId: 'heroic', difficulty: 'HC', partyType: 'party' },
  3: { difficultyId: 'normal', difficulty: '10N', partyType: 'raid' },
  4: { difficultyId: 'normal', difficulty: '25N', partyType: 'raid' },
  5: { difficultyId: 'heroic', difficulty: '10HC', partyType: 'raid' },
  6: { difficultyId: 'heroic', difficulty: '25HC', partyType: 'raid' },
  7: { difficultyId: 'lfr', difficulty: 'LFR', partyType: 'raid' },
  8: { difficultyId: 'mythic', difficulty: 'Mythic Keystone', partyType: 'party' },
  9: { difficultyId: 'normal', difficulty: '40', partyType: 'raid' },
  14: { difficultyId: 'normal', difficulty: 'N', partyType: 'raid' },
  15: { difficultyId: 'heroic', difficulty: 'HC', partyType: 'raid' },
  16: { difficultyId: 'mythic', difficulty: 'M', partyType: 'raid' },
  17: { difficultyId: 'lfr', difficulty: 'LFR', partyType: 'raid' },
  23: { difficultyId: 'mythic', difficulty: 'M', partyType: 'party' },
  24: { difficultyId: 'normal', difficulty: 'T', partyType: 'party' },
  33: { difficultyId: 'normal', difficulty: 'T', partyType: 'raid' },
  34: { difficultyId: 'pvp', difficulty: 'PvP', partyType: 'pvp' },
  150: { difficultyId: 'normal', difficulty: 'N', partyType: 'party' },
  151: { difficultyId: 'lfr', difficulty: 'T', partyType: 'raid' },
}

const videoTabsSx = {
  position: 'fixed',
  bottom: '1px',
  left: '1px',
  width: '100%',
  borderColor: '#000000',
  bgcolor: '#272e48' ,
  textColor: 'secondary',
  overflow: 'visible',
  borderTop: '1px solid',
  borderBottom: '1px solid',
  borderLeft: '1px solid',
  borderRight: '1px solid'
};

const categoryTabSx = {
  padding:'12px', 
  bgcolor: '#272e48', 
  color: 'white', 
  borderBottom: '1px solid', 
  borderColor: 'black', 
  minHeight: '1px', 
  height: '30px'
}

const categoryTabsSx = {
  borderColor: '#000000', 
  bgcolor: '#272e48', 
  textColor: 'secondary', 
  width: '175px', 
  overflow: 'visible'
}

const videoButtonSx = {
  padding: '0px', 
  borderLeft: '1px solid black', 
  borderRight: '1px solid black', 
  bgcolor: '#272e48', 
  color: 'white', 
  minHeight: '1px', 
  height: '100px', 
  width: '200px', 
  opacity: 1 
}

type WoWCharacterDamageType = 'melee' | 'ranged'
type WoWCharacterRoleType = 'tank' | 'healer' | 'damage'
type WoWCharacterClassType = 'DEATHKNIGHT' | 'DEMONHUNTER' | 'DRUID' | 'HUNTER' | 'MAGE' | 'MONK' | 'PALADIN' | 'PRIEST' | 'ROGUE' | 'SHAMAN' | 'WARLOCK' | 'WARRIOR';

type SpecializationObjectType = {
  type: WoWCharacterDamageType,
  role: WoWCharacterRoleType,
  class: WoWCharacterClassType,
  label: string,
  name: string
};

const specializationById: { [id: number]: SpecializationObjectType } = {
  250: { type: 'melee',  role: 'tank',   class: 'DEATHKNIGHT', label: 'Death Knight', name: 'Blood' },
  251: { type: 'melee',  role: 'damage', class: 'DEATHKNIGHT', label: 'Death Knight', name: 'Frost' },
  252: { type: 'melee',  role: 'damage', class: 'DEATHKNIGHT', label: 'Death Knight', name: 'Unholy' },
  577: { type: 'melee',  role: 'damage', class: 'DEMONHUNTER', label: 'Demon Hunter', name: 'Havoc' },
  581: { type: 'melee',  role: 'tank',   class: 'DEMONHUNTER', label: 'Demon Hunter', name: 'Vengeance' },
  102: { type: 'ranged', role: 'damage', class: 'DRUID',       label: 'Druid',        name: 'Balance' },
  103: { type: 'melee',  role: 'damage', class: 'DRUID',       label: 'Druid',        name: 'Feral' },
  104: { type: 'ranged', role: 'tank',   class: 'DRUID',       label: 'Druid',        name: 'Guardian' },
  105: { type: 'ranged', role: 'healer', class: 'DRUID',       label: 'Druid',        name: 'Restoration' },
  253: { type: 'ranged', role: 'damage', class: 'HUNTER',      label: 'Hunter',       name: 'Beast Mastery' },
  254: { type: 'ranged', role: 'damage', class: 'HUNTER',      label: 'Hunter',       name: 'Marksmanship' },
  255: { type: 'melee',  role: 'damage', class: 'HUNTER',      label: 'Hunter',       name: 'Survival' },
  62:  { type: 'ranged', role: 'damage', class: 'MAGE',        label: 'Mage',         name: 'Arcane' },
  63:  { type: 'ranged', role: 'damage', class: 'MAGE',        label: 'Mage',         name: 'Fire' },
  64:  { type: 'ranged', role: 'damage', class: 'MAGE',        label: 'Mage',         name: 'Frost' },
  268: { type: 'melee',  role: 'tank',   class: 'MONK',        label: 'Monk',         name: 'Brewmaster' },
  269: { type: 'melee',  role: 'damage', class: 'MONK',        label: 'Monk',         name: 'Windwalker' },
  270: { type: 'melee',  role: 'healer', class: 'MONK',        label: 'Monk',         name: 'Mistweaver' },
  65:  { type: 'melee',  role: 'healer', class: 'PALADIN',     label: 'Paladin',      name: 'Holy' },
  66:  { type: 'melee',  role: 'tank',   class: 'PALADIN',     label: 'Paladin',      name: 'Protection' },
  70:  { type: 'melee',  role: 'damage', class: 'PALADIN',     label: 'Paladin',      name: 'Retribution' },
  256: { type: 'ranged', role: 'healer', class: 'PRIEST',      label: 'Priest',       name: 'Discipline' },
  257: { type: 'ranged', role: 'healer', class: 'PRIEST',      label: 'Priest',       name: 'Holy' },
  258: { type: 'ranged', role: 'damage', class: 'PRIEST',      label: 'Priest',       name: 'Shadow' },
  259: { type: 'melee',  role: 'damage', class: 'ROGUE',       label: 'Rogue',        name: 'Assassination' },
  260: { type: 'melee',  role: 'damage', class: 'ROGUE',       label: 'Rogue',        name: 'Outlaw' },
  261: { type: 'melee',  role: 'damage', class: 'ROGUE',       label: 'Rogue',        name: 'Subtlety' },
  262: { type: 'ranged', role: 'damage', class: 'SHAMAN',      label: 'Shaman',       name: 'Elemental' },
  263: { type: 'melee',  role: 'damage', class: 'SHAMAN',      label: 'Shaman',       name: 'Enhancement' },
  264: { type: 'ranged', role: 'healer', class: 'SHAMAN',      label: 'Shaman',       name: 'Restoration' },
  265: { type: 'ranged', role: 'damage', class: 'WARLOCK',     label: 'Warlock',      name: 'Affliction' },
  266: { type: 'ranged', role: 'damage', class: 'WARLOCK',     label: 'Warlock',      name: 'Demonology' },
  267: { type: 'ranged', role: 'damage', class: 'WARLOCK',     label: 'Warlock',      name: 'Destruction' },
  71:  { type: 'melee',  role: 'damage', class: 'WARRIOR',     label: 'Warrior',      name: 'Arms' },
  72:  { type: 'melee',  role: 'damage', class: 'WARRIOR',     label: 'Warrior',      name: 'Fury' },
  73:  { type: 'melee',  role: 'tank',   class: 'WARRIOR',     label: 'Warrior',      name: 'Protection' },
};

/**
 * A map of WoW executable names to the appropriate WoW flavour
 */
const wowExecutableFlavours: { [key: string]: string } = {
  'wow':        'Retail',
  'wowt':       'PTR',
  'wowb':       'Beta',
  'wowclassic': 'Classic',
};
type WoWProcessResultKey = keyof typeof wowExecutableFlavours;

export {
    categories,
    months,
    videoTabsSx,
    categoryTabSx,
    categoryTabsSx,
    videoButtonSx,
    zones,
    arenas,
    raidEncountersById,
    battlegrounds,
    dungeonsByMapId,
    dungeonsByZoneId,
    instanceNamesByZoneId,
    dungeonTimersByMapId,
    dungeonAffixesById,
    dungeonEncounters,
    specializationById,
    instanceDifficulty,
    instanceEncountersById,
    InstanceDifficultyType,
    VideoCategory,
    raidInstances,
    categoryRecordingSettings,
    wowExecutableFlavours,
    WoWProcessResultKey,
};
