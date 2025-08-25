import { Phrase } from '../localisation/types';
import { VideoCategory } from '../types/VideoCategory';
import { ConfigurationSchemaKey } from '../config/configSchema';

import {
  NumberKeyToStringValueMapType,
  RaidInstanceType,
  StringKeyToNumberValueMapType,
} from './types';

/**
 * The set of resolutions we allow users to select.
 */
const obsResolutions = {
  /* eslint-disable prettier/prettier */
  '1024x768':  { width: 1024, height: 768 },
  '1280x720':  { width: 1280, height: 720 },
  '1280x800':  { width: 1280, height: 800 },
  '1280x1024': { width: 1280, height: 1024 },
  '1360x768':  { width: 1360, height: 768 },
  '1366x768':  { width: 1366, height: 768 },
  '1440x900':  { width: 1440, height: 900 },
  '1600x900':  { width: 1600, height: 900 },
  '1680x1050': { width: 1680, height: 1050 },
  '1920x1080': { width: 1920, height: 1080 },
  '1920x1200': { width: 1920, height: 1200 },
  '2560x1080': { width: 2560, height: 1080 },
  '2560x1440': { width: 2560, height: 1440 },
  '2560x1600': { width: 2560, height: 1600 },
  '3360x1440': { width: 3360, height: 1440 },
  '3440x1440': { width: 3440, height: 1440 },
  '3440x1200': { width: 3440, height: 1200 },
  '3520x990':  { width: 3520, height: 990 },
  '3840x1080': { width: 3840, height: 1080 },
  '3840x1440': { width: 3840, height: 1440 },
  '3840x1600': { width: 3840, height: 1600 },
  '3840x2160': { width: 3840, height: 2160 },
  '5120x1440': { width: 5120, height: 1440 },
  '5120x2160': { width: 5120, height: 2160 },
  '5760x1080': { width: 5760, height: 1080 },
  '7680x2160': { width: 7680, height: 2160 },
  /* eslint-enable prettier/prettier */
};

interface ICategoryRecordingSettings {
  allowRecordKey: ConfigurationSchemaKey;
  autoUploadKey: ConfigurationSchemaKey;
}

/**
 * Category specific settings for recording
 *
 * `configKey`:    The configuration key name that specifies if we're allowed
 *                 to record content from that particular category.
 */
type CategoryRecordingSettingsBase = {
  [key in VideoCategory]: ICategoryRecordingSettings;
};

const categoryRecordingSettings: Omit<
  CategoryRecordingSettingsBase,
  VideoCategory.Clips
> = {
  [VideoCategory.TwoVTwo]: {
    allowRecordKey: 'recordTwoVTwo',
    autoUploadKey: 'cloudUpload2v2',
  },
  [VideoCategory.ThreeVThree]: {
    allowRecordKey: 'recordThreeVThree',
    autoUploadKey: 'cloudUpload3v3',
  },
  [VideoCategory.FiveVFive]: {
    allowRecordKey: 'recordFiveVFive',
    autoUploadKey: 'cloudUpload5v5',
  },
  [VideoCategory.Skirmish]: {
    allowRecordKey: 'recordSkirmish',
    autoUploadKey: 'cloudUploadSkirmish',
  },
  [VideoCategory.SoloShuffle]: {
    allowRecordKey: 'recordSoloShuffle',
    autoUploadKey: 'cloudUploadSoloShuffle',
  },
  [VideoCategory.MythicPlus]: {
    allowRecordKey: 'recordDungeons',
    autoUploadKey: 'cloudUploadDungeons',
  },
  [VideoCategory.Raids]: {
    allowRecordKey: 'recordRaids',
    autoUploadKey: 'cloudUploadRaids',
  },
  [VideoCategory.Battlegrounds]: {
    allowRecordKey: 'recordBattlegrounds',
    autoUploadKey: 'cloudUploadBattlegrounds',
  },
};

/**
 * Months of the year.
 */
const months: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Retail battlegrounds by ID.
 */
const retailBattlegrounds: NumberKeyToStringValueMapType = {
  30: 'Alterac Valley',
  2107: 'Arathi Basin',
  1681: 'Arathi Basin',
  1105: 'Deepwind Gorge',
  2245: 'Deepwind Gorge',
  566: 'Eye of the Storm',
  968: 'Eye of the Storm',
  628: 'Isle of Conquest',
  1803: 'Seething Shore',
  727: 'Silvershard Mines',
  998: 'Temple of Kotmogu',
  761: 'The Battle for Gilneas',
  726: 'Twin Peaks',
  489: 'Warsong Gulch',
  2106: 'Warsong Gulch',
  2656: 'Deephaul Ravine',
  2188: 'Wintergrasp',
};

/**
 * Classic battlegrounds by ID. This is probably totally wrong.
 */
const classicBattlegrounds: NumberKeyToStringValueMapType = {
  30: 'Alterac Valley',
  529: 'Arathi Basin',
  566: 'Eye of the Storm',
  607: 'Strand of the Ancients',
  489: 'Warsong Gulch',
};

/**
 * Retail arenas by ID.
 */
const retailArenas: NumberKeyToStringValueMapType = {
  1672: "Blade's Edge",
  617: 'Dalaran Sewers',
  1505: 'Nagrand',
  572: 'Ruins of Lordaeron',
  2167: 'Robodrome',
  1134: "Tiger's Peak",
  980: "Tol'viron",
  1504: 'Black Rook',
  2373: 'Empyrean Domain',
  1552: "Ashamane's Fall",
  1911: 'Mugambala',
  1825: 'Hook Point',
  2509: 'Maldraxxus',
  2547: 'Enigma Crucible',
  2563: 'Nokhudon',
  2759: 'Cage of Carnage',
};

/**
 * Classic arenas by ID.
 */
const classicArenas: NumberKeyToStringValueMapType = {
  572: 'Ruins of Lordaeron',
  559: 'Nagrand',
  617: 'Dalaran',
  562: "Blade's Edge",
  1134: "Tiger's Peak",
  980: "Tol'viron",
};

/**
 * Shadowlands Tier 1
 */
const encountersNathria: NumberKeyToStringValueMapType = {
  2398: 'Shriekwing',
  2418: 'Huntsman',
  2402: 'Sun King',
  2405: "Xy'mox",
  2383: 'Hungering',
  2406: 'Inerva',
  2412: 'Council',
  2399: 'Sludgefist',
  2417: 'SLG',
  2407: 'Denathrius',
};

/**
 * Shadowlands Tier 2
 */
const encountersSanctum: NumberKeyToStringValueMapType = {
  2523: 'The Tarragrue',
  2433: "Jailer's Eye",
  2429: 'The Nine',
  2432: "Ner'zhul",
  2434: 'Souldrender',
  2430: 'Painsmith',
  2436: 'Guardian',
  2431: 'Fatescribe',
  2422: "Kel'Thuzad",
  2435: 'Sylvanas',
};

/**
 * Shadowlands Tier 3
 */
const encountersSepulcher: NumberKeyToStringValueMapType = {
  2537: 'Jailer',
  2512: 'Guardian',
  2529: 'Halondrus',
  2539: 'Lihuvim',
  2540: 'Dausegne',
  2542: 'Skolex',
  2543: 'Lords',
  2544: 'Pantheon',
  2546: 'Anduin',
  2549: 'Rygelon',
  2553: "Xy'mox",
};

/**
 * Dragonflight Tier 1
 */
const encountersVOI: NumberKeyToStringValueMapType = {
  2587: 'Eranog',
  2639: 'Terros',
  2590: 'Primal',
  2592: 'Sennarth',
  2635: 'Dathea',
  2605: 'Kurog',
  2614: 'Diurna',
  2607: 'Raszageth',
};

/**
 * Dragonflight Tier 2
 */
const encountersAberrus: NumberKeyToStringValueMapType = {
  2688: 'Kazzara',
  2687: 'Amalgamation Chamber',
  2693: 'The Forgotten Experiments',
  2682: 'Assault of the Zaqali',
  2680: 'Rashok',
  2689: 'Zskarn',
  2683: 'Magmorax',
  2684: 'Echo of Neltharion',
  2685: 'Scalecommander Sarkareth',
};

/**
 * WOTLK Classic Naxxrammas
 */
const encountersClassicNaxxramas: NumberKeyToStringValueMapType = {
  1107: "Anub'Rekhan",
  1110: 'Faerlina',
  1116: 'Maexxna',
  1118: 'Patchwerk',
  1117: 'Noth',
  1112: 'Heigan',
  1115: 'Lotheb',
  1113: 'Razuvious',
  1109: 'Gothik',
  1121: 'Horsemen',
  1119: 'Sapphiron',
  1120: 'Thaddius',
  1114: "Kel'Thuzad",
  1111: 'Grobbulus',
  1108: 'Gluth',
};

/**
 * WOTLK Classic Eye of Eternity
 */
const encountersClassicEye: NumberKeyToStringValueMapType = {
  734: 'Malygos',
};

/**
 * WOTLK Classic Obsidian Sanctum
 */
const encountersClassicObsidian: NumberKeyToStringValueMapType = {
  742: 'Sartharion',
};

/**
 * WOTLK Classic Vault of Archavon
 */
const encountersClassicVault: NumberKeyToStringValueMapType = {
  772: 'Archavon',
};

/**
 * WOTLK Classic Ulduar
 */
const encountersClassicUlduar: NumberKeyToStringValueMapType = {
  744: 'Flame Leviathan',
  745: 'Ignis',
  746: 'Razorscale',
  747: 'XT-002',
  748: 'Assembly of Iron',
  749: 'Kologarn',
  750: 'Auriaya',
  751: 'Hodir',
  752: 'Thorim',
  753: 'Freya',
  754: 'Mimiron',
  755: 'General Vezax',
  756: 'Yogg-Saron',
  757: 'Algalon',
};

/**
 * WOTLK Classic TOC
 */
const encountersClassicTOC: NumberKeyToStringValueMapType = {
  629: 'Northrend Beasts',
  633: 'Lord Jaraxxus',
  637: 'Faction Champions',
  641: "Val'kyr Twins",
  645: "Anub'arak",
};

const raidEncountersById: NumberKeyToStringValueMapType = {
  ...encountersNathria,
  ...encountersSanctum,
  ...encountersSepulcher,
  ...encountersVOI,
  ...encountersAberrus,
  ...encountersClassicNaxxramas,
  ...encountersClassicEye,
  ...encountersClassicObsidian,
  ...encountersClassicVault,
  ...encountersClassicUlduar,
  ...encountersClassicTOC,
};

/**
 * List of the raid encounters for the current tier of raid bosses. This
 * enables the "record current tier only" option, and needs updated with each
 * new tier.
 *
 * Typically will do a bit of overlap on a new tier so that we can cover PTR,
 * and retail at the same time. Eventually the older tiers should be removed.
 */
const currentRetailEncounters = [
  // TWW Season 2
  3009, // Vexie
  3010, // Cauldron
  3011, // Rik
  3012, // Stix
  3013, // Sprocket
  3014, // Bandit
  3015, // Mug'Zee
  3016, // Gally

  // TWW Season 3
  3129, // Plexus Sentinel
  3131, // Loom'ithar
  3130, // Soulbinder Naazindhri
  3132, // Forgeweaver Araz
  3122, // The Soul Hunters
  3133, // Fractillus
  3134, // Nexus-King Salhadaar
  3135, // Dimensius, the All-Devouring

  // Test Encounter
  9999, // Saves having to update the test button data.
];

/**
 * List of raids and their encounters
 * This is used to figure out the raid name of a given encounter as that
 * information is not available in `ENCOUNTER_START` and we shouldn't and
 * can't rely on `ZONE_CHANGE` for this.
 */
const raidInstances: RaidInstanceType[] = [
  {
    zoneId: 13224,
    name: 'Castle Nathria',
    shortName: 'Nathria',
    encounters: encountersNathria,
  },
  {
    zoneId: 13561,
    name: 'Sanctum of Domination',
    shortName: 'Sanctum',
    encounters: encountersSanctum,
  },
  {
    zoneId: 13742,
    name: 'Sepulcher of the First Ones',
    shortName: 'Sepulcher',
    encounters: encountersSepulcher,
  },
  {
    zoneId: 14030,
    name: 'Vault of the Incarnates',
    shortName: 'Vault',
    encounters: encountersVOI,
  },
  {
    zoneId: 14663,
    name: 'Aberrus, the Shadowed Crucible',
    shortName: 'Aberrus',
    encounters: encountersAberrus,
  },
  {
    zoneId: 3456,
    name: 'Naxxramas',
    shortName: 'Naxxramas',
    encounters: encountersClassicNaxxramas,
  },
  {
    zoneId: 4500,
    name: 'Eye of Eternity',
    shortName: 'EoE',
    encounters: encountersClassicEye,
  },
  {
    zoneId: 4493,
    name: 'Obsidian Sanctum',
    shortName: 'OS',
    encounters: encountersClassicObsidian,
  },
  {
    zoneId: 4603,
    name: 'Vault of Archavon',
    shortName: 'VoA',
    encounters: encountersClassicVault,
  },
  {
    zoneId: 4273,
    name: 'Ulduar',
    shortName: 'Ulduar',
    encounters: encountersClassicUlduar,
  },
  {
    zoneId: 4722,
    name: 'Trial of the Crusader',
    shortName: 'ToC',
    encounters: encountersClassicTOC,
  },
];

/**
 * Dungeons by zone ID. This might technically be "instanceID". Get these from
 * here: https://wowpedia.fandom.com/wiki/InstanceID.
 */
const dungeonsByZoneId: NumberKeyToStringValueMapType = {
  // Shadowlands
  1651: 'Return to Karazhan',
  1208: 'Grimrail Depot',
  1195: 'Iron Docks',
  2097: 'Operation: Mechagon',
  2291: 'De Other Side',
  2287: 'Halls of Atonement',
  2290: 'Mists of Tirna Scithe',
  2289: 'Plaguefall',
  2284: 'Sanguine Depths',
  2285: 'Spires of Ascension',
  2286: 'The Necrotic Wake',
  2293: 'Theater of Pain',
  2441: 'Tazavesh the Veiled Market',

  // Dragonflight S1
  2521: 'Ruby Life Pools',
  2516: 'The Nokhud Offensive',
  2515: 'The Azure Vault',
  2526: "Algeth'ar Academy",
  1477: 'Halls of Valor',
  1571: 'Court of Stars',
  1176: 'Shadowmoon Burial Grounds',
  960: 'Temple of the Jade Serpent',

  // Dragonflight S2
  2520: 'Brackenhide Hollow',
  2527: 'Halls of Infusion',
  2451: 'Uldaman: Legacy of Tyr',
  2519: 'Neltharus',
  1754: 'Freehold',
  1841: 'The Underrot',
  1458: "Neltharion's Lair",
  657: 'The Vortex Pinnacle',

  // Dragonflight S3
  2579: 'Dawn of the Infinite',
  1862: 'Waycrest Manor',
  1466: 'Darkheart Thicket',
  1501: 'Black Rook Hold',
  1763: "Atal'Dazar",
  1279: 'The Everbloom',
  643: 'Throne of the Tides',

  // TWW S1 - not on wiki yet.
  // Taken from https://github.com/BigWigsMods/BigWigs/blob/master/Loader.lua#L487.
  670: 'Grim Batol',
  1822: 'Siege of Boralus',
  2652: 'The Stonevault',
  2660: 'Ara-Kara, City of Echoes',
  2662: 'The Dawnbreaker',
  2669: 'City of Threads',

  // TWW S2.
  // Taken from https://github.com/BigWigsMods/BigWigs/blob/master/Loader.lua#L487.
  2649: 'Priory of the Sacred Flame',
  2651: 'Darkflame Cleft',
  2648: 'The Rookery',
  2661: 'Cinderbrew Meadery',
  2773: 'Operation: Floodgate',
  1594: 'THE MOTHERLODE!!',

  // TWW S3.
  // Taken from https://github.com/BigWigsMods/BigWigs/blob/master/Loader.lua#L487.
  2830: "Eco-Dome Al'Dani",
};

/**
 * Dungeons by MapID. Get this by going to the keystone page on wowhead, e.g.:
 * https://www.wowhead.com/spell=393483/set-keystone-map-shadowmoon-burial-grounds
 * and extracting the effect ID.
 */
const dungeonsByMapId: NumberKeyToStringValueMapType = {
  // Shadowlands
  166: 'Grimrail Depot',
  169: 'Iron Docks',
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

  // Dragonflight S1
  399: 'Ruby Life Pools',
  400: 'The Nokhud Offensive',
  401: 'The Azure Vault',
  402: "Algeth'ar Academy",
  200: 'Halls of Valor',
  210: 'Court of Stars',
  165: 'Shadowmoon Burial Grounds',
  2: 'Temple of the Jade Serpent',

  // Dragonflight S2
  405: 'Brackenhide Hollow',
  406: 'Halls of Infusion',
  403: 'Uldaman: Legacy of Tyr',
  404: 'Neltharus',
  245: 'Freehold',
  251: 'The Underrot',
  206: "Neltharion's Lair",
  438: 'The Vortex Pinnacle',

  // Dragonflight S3
  463: "Galakrond's Fall",
  464: "Murozond's Rise",
  248: 'Waycrest Manor',
  198: 'Darkheart Thicket',
  199: 'Black Rook Hold',
  244: "Atal'Dazar",
  168: 'The Everbloom',
  456: 'Throne of the Tides',

  // TWW S1 - taken from WoWhead, searching for "set keystone map X".
  353: 'Siege of Boralus',
  501: 'The Stonevault',
  502: 'City of Threads',
  503: 'Ara-Kara, City of Echoes',
  505: 'The Dawnbreaker',
  507: 'Grim Batol',

  // TWW S2 - taken from WoWhead, searching for "set keystone map X".
  499: 'Priory of the Sacred Flame',
  504: 'Darkflame Cleft',
  500: 'The Rookery',
  506: 'Cinderbrew Meadery',
  247: 'THE MOTHERLODE!!',
  525: 'Operation: Floodgate',

  // TWW S3 - taken from WoWhead, searching for "set keystone map X".
  542: "Eco-Dome Al'Dani",
};

/**
 * Alloted time for Mythic Keystone dungeons, in seconds, the format of:
 *
 * mapId: [1 chest, 2 chest, 3 chest]
 *
 * The first is obviously also the one the determines if a key was timed or not.
 *
 * Tip: It's easier to keep them as a calculation here, for comparison when Blizzard
 * occasionally adjusts timers for a dungeon.
 */
const dungeonTimersByMapId: { [id: number]: number[] } = {
  // Shadowlands
  377: [43 * 60, 34 * 60 + 25, 25 * 60 + 49],
  378: [32 * 60, 32 * 60 * 0.8, 32 * 60 + 0.6], // Halls of Atonement
  375: [30 * 60, 24 * 60, 18 * 60], // Mists of Tirna Scithe
  379: [38 * 60, 30 * 60 + 24, 22 * 60 + 38],
  380: [41 * 60, 32 * 60 + 48, 24 * 60 + 36],
  381: [39 * 60, 31 * 60 + 12, 23 * 60 + 24],
  376: [32 * 60 + 30, 26 * 60 + 18, 20 * 60 + 6], // The Necrotic Wake
  382: [34 * 60, 27 * 60 + 12, 20 * 60 + 24], // Theater of Pain
  227: [42 * 60, 33 * 60 + 36, 25 * 60 + 12],
  234: [35 * 60, 28 * 60, 21 * 60],
  369: [38 * 60, 30 * 60 + 24, 22 * 60 + 38],
  370: [32 * 60, 25 * 60 + 36, 19 * 60 + 12], // Operation: Mechagon - Workshop
  391: [35 * 60, 35 * 60 * 0.8, 35 * 60 * 0.6], // Tazavesh: Streets of Wonder
  392: [30 * 60, 24 * 60, 18 * 60], // Tazavesh: So'leah's Gambit
  169: [30 * 60, 24 * 60, 18 * 60],
  166: [30 * 60, 24 * 60, 18 * 60],

  // Dragonflight S1
  399: [30 * 60, 24 * 60, 18 * 60],
  400: [40 * 60, 32 * 60, 24 * 60],
  401: [37 * 60 + 30, 30 * 60, 22 * 60 + 30],
  402: [32 * 60, 25 * 60 + 36, 19 * 60 + 12],
  200: [38 * 60, 30 * 60 + 24, 22 * 60 + 48],
  210: [30 * 60, 24 * 60, 18 * 60],
  165: [33 * 60, 26 * 60 + 24, 19 * 60 + 48],
  2: [30 * 60, 24 * 60, 18 * 60],

  // Dragonflight S2
  405: [35 * 60, 28 * 60, 21 * 60],
  406: [35 * 60, 28 * 60, 21 * 60],
  403: [35 * 60, 28 * 60, 21 * 60],
  404: [33 * 60, 26 * 60 + 24, 19 * 60 + 48],
  245: [30 * 60, 24 * 60, 18 * 60],
  251: [30 * 60, 24 * 60, 18 * 60],
  206: [33 * 60, 26 * 60 + 24, 19 * 60 + 48],
  438: [30 * 60, 24 * 60, 18 * 60],

  // Dragonflight S3
  463: [34 * 60, 27 * 60 + 12, 20 * 60 + 24],
  464: [36 * 60, 28 * 60, 21 * 60],
  248: [36 * 60 + 40, 29 * 60 + 20, 22 * 60],
  198: [30 * 60, 24 * 60, 18 * 60],
  199: [36 * 60, 28 * 60 + 48, 23 * 60 + 24],
  244: [30 * 60, 24 * 60, 18 * 60],
  168: [33 * 60, 26 * 60 + 24, 19 * 60 + 48],
  456: [34 * 60, 27 * 60 + 12, 20 * 60 + 24],

  // TWW S1
  // Don't have exact timers yet so for now have assumed 0.8 and 0.6 multipliers.
  // https://overgear.com/guides/wow/the-war-within-mythic-guide/.
  501: [33 * 60, 33 * 60 * 0.8, 33 * 60 * 0.6], // The Stonevault
  503: [30 * 60, 30 * 60 * 0.8, 30 * 60 * 0.6], // Ara-Kara, City of Echoes
  353: [33 * 60, 33 * 60 * 0.8, 33 * 60 * 0.6], // Siege of Boralus
  502: [35 * 60, 35 * 60 * 0.8, 35 * 60 * 0.6], // City of Threads
  505: [31 * 60, 31 * 60 * 0.8, 31 * 60 * 0.6], // The Dawnbreaker
  507: [34 * 60, 34 * 60 * 0.8, 34 * 60 * 0.6], // Grim Batol

  // TWW S2
  // Don't have exact timers yet so for now have assumed 0.8 and 0.6 multipliers.
  // https://www.wowhead.com/guide/mythic-plus-dungeons/the-war-within-season-2/overview.
  506: [33 * 60, 26 * 60 + 24, 19 * 60 + 48], // 'Cinderbrew Meadery'
  504: [31 * 60, 24 * 60 + 24, 18 * 60 + 48], // 'Darkflame Cleft'
  500: [29 * 60, 23 * 60 + 24, 17 * 60 + 48], // 'The Rookery'
  499: [32 * 60 + 30, 26 * 60, 19 * 60 + 30], // 'Priory of the Sacred Flame'
  525: [33 * 60, 26 * 60 + 24, 19 * 60 + 48], // 'Operation: Floodgate'
  247: [33 * 60, 33 * 60 * 0.8, 33 * 60 * 0.6], // 'THE MOTHERLODE!!'

  // TWW S3
  // Timings from https://www.wowhead.com/guide/mythic-plus-dungeons/the-war-within-season-3/overview.
  542: [31 * 60, 31 * 60 * 0.8, 31 * 60 * 0.6], // "Eco-Dome Al'Dani"
};

// Useful database for grabbing this stuff:
// https://wago.tools/db2/JournalEncounter?build=11.0.2.55789&filter[Name_lang]=Erudax&page=1
// Make sure to pick the most recent build. Column we need is "DungeonEncounterID".
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

  // Ruby Life Pools
  2609: 'Melidrussa Chillworn',
  2606: 'Kokia Blazehoof',
  2623: 'Kyrakka and Erhkard Stormvein',

  // The Nokhud Offensive
  2637: 'Granyth',
  2636: 'The Raging Tempest',
  2581: 'Teera and Maruuk',
  2580: 'Balakar Khan',

  // The Azure Vault
  2582: 'Leymor',
  2585: 'Azureblade',
  2583: 'Telash Greywing',
  2584: 'Umbrelskul',

  // Algeth'ar Acedemy
  2562: 'Vexamus',
  2563: 'Overgrown Ancient',
  2564: 'Crawth',
  2565: 'Echo of Doragosa',

  // Halls of Valor
  1805: 'Hymdall',
  1806: 'Hyrja',
  1807: 'Fenryr',
  1808: 'God-King Skovald',
  1809: 'Odyn',

  // Court of Stars
  1868: 'Patrol Captain Gerdo',
  1869: 'Talixae Flamewreath',
  1870: 'Advisor Melandrus',

  // Shadowmmon Burial Grounds
  1677: 'Sadana Bloodfury',
  1688: 'Nhallish',
  1679: 'Bonemaw',
  1682: "Ner'zhul",

  // Temple of the Jade Serpent
  1418: 'Wise Mari',
  1417: 'Lorewalker Stonestep',
  1416: 'Liu Flameheart',
  1439: 'Sha of Doubt',

  // Brackenhide Hollow
  2570: "Hackclaw's War-Band",
  2567: 'Gutshot',
  2568: 'Treemouth',
  2569: 'Decatriarch Wratheye',

  // Halls of Infusion
  2615: 'Watcher Irideus',
  2616: 'Gulping Goliath',
  2617: 'Khajin the Unyielding',
  2618: 'Primal Tsunami',

  // Uldaman: Legacy of Tyr
  2555: 'The Lost Dwarves',
  2556: 'Bromach',
  2557: 'Sentinel Talondras',
  2558: 'Emberon',
  2559: 'Chrono-Lord Deios',

  // Neltharus
  2610: 'Magmatusk',
  2611: 'Warlord Sargha',
  2612: 'Forgemaster Gorek',
  2613: 'Chargath, Bane of Scales',

  // Freehold
  2093: "Skycap'n Kragg",
  2094: "Council o' Captains",
  2095: 'Ring of Booty',
  2096: 'Harlan Sweete',

  // The Underrot
  2111: 'Elder Leaxa',
  2118: 'Cragmaw the Infested',
  2112: 'Sporecaller Zancha',
  2123: 'Unbound Abomination',

  // Neltharion's Lair
  1790: 'Rokmora',
  1791: 'Ularogg Cragshaper',
  1792: 'Naraxas',
  1793: 'Dargrul the Underking',

  // The Vortex Pinnacle
  1041: 'Altairus',
  1042: 'Asaad, Caliph of Zephyrs',
  1043: 'Grand Vizier Ertan',

  // Waycrest Manor
  2113: 'Heartsbane Triad',
  2114: 'Soulbound Goliath',
  2115: 'Raal the Gluttonous',
  2116: 'Lord and Lady Waycrest',
  2117: 'Gorak Tul',

  // Black Rook Hold
  1832: 'The Amalgam of Souls',
  1833: 'Illysanna Ravencrest',
  1834: 'Smashspite the Hateful',
  1835: "Lord Kur'talos Ravencrest",

  // Throne of the Tides
  1045: "Lady Naz'jar",
  1044: 'Commander Ulthok, the Festering Prince',
  1046: "Mindbender Ghur'sha",
  1047: 'Ozumat',

  // Everbloom
  1746: 'Witherbark',
  1757: 'Ancient Protectors',
  1751: 'Archmage Sol',
  1756: 'Yalnu',

  // Atal'Dazar
  2084: "Priestess Alun'za",
  2086: 'Rezan',
  2085: "Vol'kaal",
  2087: 'Yazma',

  // Dawn of the Infinites: Galakdron's Fall
  2666: 'Chronikar',
  2667: 'Manifested Timeways',
  2668: 'Blight of Galakrond',
  2669: 'Iridikron the Stonescaled',

  // Dawn of the Infinites: Murozond's Rise
  2670: 'Tyr, the Infinite Keeper',
  2671: 'Morchie',
  2672: 'Time-Lost Battlefield',
  2673: 'Chrono-Lord Deios',

  // Darkheart Thicket
  1836: 'Archdruid Glaidalis',
  1837: 'Oakheart',
  1838: 'Dresaron',
  1839: 'Shade of Xavius',

  // The Stonevault
  2854: 'E.D.N.A',
  2880: 'Skarmorak',
  2888: 'Master Machinists',
  2883: 'Void Speaker Eirich',

  // The Dawnbreaker
  2837: 'Speaker Shadowcrown',
  2838: "Anub'ikkaj",
  2839: "Rasha'nan",

  // City of Threads
  2907: "Orator Krix'vizk",
  2908: 'Fangs of the Queen',
  2905: 'The Coaglamation',
  2909: 'Izo, the Grand Splicer',

  // Ara-Kara, City of Echoes
  2926: 'Avanoxx',
  2906: "Anub'zekt",
  2901: "Ki'katal the Harvester",

  // Siege of Boralus
  2098: 'Chopper Redhook',
  2109: 'Dread Captain Lockwood',
  2099: 'Hadal Darkfathom',
  2100: "Viq'Goth",

  // Grim Batol
  1051: 'General Umbriss',
  1050: 'Forgemaster Throngus',
  1048: 'Drahga Shadowburner',
  1049: 'Erudax, the Duke of Below',

  // Priory of the Sacred Flame
  2847: 'Captain Dailcry',
  2835: 'Baron Braunpyke',
  2848: 'Prioress Murrpray',

  // Darkflame Cleft
  2829: "Ol' Waxbeard",
  2826: 'Blazikon',
  2787: 'The Candle King',
  2788: 'The Darkness',

  // The Rookery
  2816: 'Kyrioss',
  2861: 'Stormguard Gorren',
  2836: 'Voidstone Monstrosity',

  // Cinderbrew Meadery
  2900: 'Brew Master Aldryr',
  2929: "I'pa",
  2931: 'Benk Buzzbee',
  2930: 'Goldie Baronbottom',

  // Operation: Floodgate
  3020: 'Big M.O.M.M.A.',
  3054: 'Geezle Gigazap',
  3053: 'Swampface',
  3019: 'Demolition Duo',

  // THE MOTHERLODE!!
  2105: 'Coin-Operated Crowd Pummeler',
  2106: 'Azerokk',
  2107: 'Rixxa Fluxflame',
  2108: 'Mogul Razdunk',

  // Eco-Dome Al'Dani
  3107: 'Azhiccar',
  3108: "Taah'bat and A'wazj",
  3109: 'Soul-Scribe',
};

const instanceNamesByZoneId: NumberKeyToStringValueMapType = {
  ...retailBattlegrounds,
  ...classicBattlegrounds,
  ...retailArenas,
  ...classicArenas,
  ...dungeonsByZoneId,
};

// https://www.wowhead.com/beta/affixes was handy when finding TWW beta affixes.
// Remember to add thumbnails (from Wowhead) to assets/affixes/<id>.jpg.
// Some of these are shortened so they fit.
const dungeonAffixesById: NumberKeyToStringValueMapType = {
  1: 'Overflowing',
  2: 'Skittish',
  3: 'Volcanic',
  4: 'Necrotic',
  5: 'Teeming',
  6: 'Raging',
  7: 'Bolstering',
  8: 'Sanguine',
  9: 'Tyrannical',
  10: 'Fortified',
  11: 'Bursting',
  12: 'Grievous',
  13: 'Explosive',
  14: 'Quaking',
  117: 'Reaping',
  120: 'Awakened',
  121: 'Prideful',
  122: 'Inspiring',
  123: 'Spiteful',
  124: 'Storming',
  128: 'Tormented',
  130: 'Encrypted',
  131: 'Shrouded',
  133: 'Focused',
  134: 'Entangling',
  135: 'Afflicted',
  136: 'Incorporeal',
  137: 'Shielding',
  144: 'Thorned',
  145: 'Reckless',
  146: 'Attuned',
  147: 'Guile',
  148: 'Ascendant',
  152: 'Peril',
  153: 'Frenzied',
  158: 'Voidbound',
  159: 'Oblivion',
  160: 'Devour',
  162: 'Pulsar',
};

/**
 * Zones by ID.
 */
const zones: NumberKeyToStringValueMapType = {
  ...retailArenas,
  ...classicArenas,
  ...raidEncountersById,
  ...retailBattlegrounds,
  ...classicBattlegrounds,
  ...dungeonsByZoneId,
};

const instanceEncountersById: NumberKeyToStringValueMapType = {
  ...raidEncountersById,
  ...dungeonEncounters,
};

type InstanceDifficultyPartyType = 'party' | 'raid' | 'pvp';
type InstanceDifficultyIdType = 'lfr' | 'normal' | 'heroic' | 'mythic' | 'pvp';
type InstanceDifficultyType = {
  difficultyID: InstanceDifficultyIdType;
  difficulty: string;
  partyType: InstanceDifficultyPartyType;
  phrase: Phrase;
};
type InstanceDifficultyObjectType = {
  [key: number]: InstanceDifficultyType;
};

// See https://wowpedia.fandom.com/wiki/DifficultyID.
const instanceDifficulty: InstanceDifficultyObjectType = {
  1: {
    difficultyID: 'normal',
    difficulty: 'N',
    partyType: 'party',
    phrase: Phrase.Normal,
  },
  2: {
    difficultyID: 'heroic',
    difficulty: 'HC',
    partyType: 'party',
    phrase: Phrase.Heroic,
  },
  3: {
    difficultyID: 'normal',
    difficulty: '10N',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
  4: {
    difficultyID: 'normal',
    difficulty: '25N',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
  5: {
    difficultyID: 'heroic',
    difficulty: '10HC',
    partyType: 'raid',
    phrase: Phrase.Heroic,
  },
  6: {
    difficultyID: 'heroic',
    difficulty: '25HC',
    partyType: 'raid',
    phrase: Phrase.Heroic,
  },
  7: {
    difficultyID: 'lfr',
    difficulty: 'LFR',
    partyType: 'raid',
    phrase: Phrase.LFR,
  },
  8: {
    difficultyID: 'mythic',
    difficulty: 'Mythic Keystone',
    partyType: 'party',
    phrase: Phrase.Mythic,
  },
  9: {
    difficultyID: 'normal',
    difficulty: '40',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },

  // Retail raids
  14: {
    difficultyID: 'normal',
    difficulty: 'N',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
  15: {
    difficultyID: 'heroic',
    difficulty: 'HC',
    partyType: 'raid',
    phrase: Phrase.Heroic,
  },
  16: {
    difficultyID: 'mythic',
    difficulty: 'M',
    partyType: 'raid',
    phrase: Phrase.Mythic,
  },
  17: {
    difficultyID: 'lfr',
    difficulty: 'LFR',
    partyType: 'raid',
    phrase: Phrase.LFR,
  },

  23: {
    difficultyID: 'mythic',
    difficulty: 'M',
    partyType: 'party',
    phrase: Phrase.Mythic,
  },
  24: {
    difficultyID: 'normal',
    difficulty: 'T',
    partyType: 'party',
    phrase: Phrase.Normal,
  },
  33: {
    difficultyID: 'normal',
    difficulty: 'T',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
  34: {
    difficultyID: 'pvp',
    difficulty: 'PvP',
    partyType: 'pvp',
    phrase: Phrase.Pvp,
  },
  150: {
    difficultyID: 'normal',
    difficulty: 'N',
    partyType: 'party',
    phrase: Phrase.Normal,
  },
  151: {
    difficultyID: 'lfr',
    difficulty: 'T',
    partyType: 'raid',
    phrase: Phrase.LFR,
  },
  175: {
    difficultyID: 'normal',
    difficulty: '10N',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
  176: {
    difficultyID: 'normal',
    difficulty: '25N',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
  185: {
    difficultyID: 'normal',
    difficulty: 'N',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
  186: {
    difficultyID: 'normal',
    difficulty: 'N',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
  193: {
    difficultyID: 'heroic',
    difficulty: '10HC',
    partyType: 'raid',
    phrase: Phrase.Heroic,
  },
  194: {
    difficultyID: 'heroic',
    difficulty: '25HC',
    partyType: 'raid',
    phrase: Phrase.Heroic,
  },

  // Classic era 10 man?
  198: {
    difficultyID: 'normal',
    difficulty: '10N',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
  215: {
    difficultyID: 'normal',
    difficulty: '10N',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
  226: {
    difficultyID: 'normal',
    difficulty: 'N',
    partyType: 'raid',
    phrase: Phrase.Normal,
  },
};

const categoryTabSx = {
  padding: '12px',
  color: 'white',
  borderBottom: '1px solid',
  borderColor: 'black',
  minHeight: '1px',
  height: '30px',
};

const categoryTabsSx = {
  borderColor: '#000000',
  textColor: 'secondary',
  width: '175px',
  overflow: 'visible',
};

const videoButtonSx = {
  padding: '0px',
  margin: 0.5,
  border: '1px solid black',
  color: 'white',
  minHeight: '1px',
  height: '100px',
  width: '200px',
  opacity: 1,
  borderRadius: 2,
};

const scrollBarSx = {
  scrollbarWidth: 'thin',
  '&::-webkit-scrollbar': {
    width: '0.125em',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
    boxSizing: 'border-box',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'hsl(var(--popover))',
    borderRadius: '6px',
    boxSizing: 'border-box',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: '#555',
  },
};

type WoWCharacterDamageType = 'melee' | 'ranged';
type WoWCharacterRoleType = 'tank' | 'healer' | 'damage';
type WoWCharacterClassType =
  | 'DEATHKNIGHT'
  | 'DEMONHUNTER'
  | 'DRUID'
  | 'HUNTER'
  | 'MAGE'
  | 'MONK'
  | 'PALADIN'
  | 'PRIEST'
  | 'ROGUE'
  | 'SHAMAN'
  | 'WARLOCK'
  | 'WARRIOR'
  | 'EVOKER'
  | 'UNKNOWN';

const WoWClassColor = {
  DEATHKNIGHT: '#C41E3A',
  DEMONHUNTER: '#A330C9',
  DRUID: '#FF7C0A',
  HUNTER: '#AAD372',
  MAGE: '#3FC7EB',
  MONK: '#00FF98',
  PALADIN: '#F48CBA',
  PRIEST: '#FFFFFF',
  ROGUE: '#FFF468',
  SHAMAN: '#0070DD',
  WARLOCK: '#8788EE',
  WARRIOR: '#C69B6D',
  EVOKER: '#33937F',
  UNKNOWN: 'grey',
};

type SpecializationObjectType = {
  type: WoWCharacterDamageType;
  role: WoWCharacterRoleType;
  class: WoWCharacterClassType;
  label: string;
  name: string;
};

const specializationById: { [id: number]: SpecializationObjectType } = {
  250: {
    type: 'melee',
    role: 'tank',
    class: 'DEATHKNIGHT',
    label: 'Death Knight',
    name: 'Blood',
  },
  251: {
    type: 'melee',
    role: 'damage',
    class: 'DEATHKNIGHT',
    label: 'Death Knight',
    name: 'Frost',
  },
  252: {
    type: 'melee',
    role: 'damage',
    class: 'DEATHKNIGHT',
    label: 'Death Knight',
    name: 'Unholy',
  },
  577: {
    type: 'melee',
    role: 'damage',
    class: 'DEMONHUNTER',
    label: 'Demon Hunter',
    name: 'Havoc',
  },
  581: {
    type: 'melee',
    role: 'tank',
    class: 'DEMONHUNTER',
    label: 'Demon Hunter',
    name: 'Vengeance',
  },
  102: {
    type: 'ranged',
    role: 'damage',
    class: 'DRUID',
    label: 'Druid',
    name: 'Balance',
  },
  103: {
    type: 'melee',
    role: 'damage',
    class: 'DRUID',
    label: 'Druid',
    name: 'Feral',
  },
  104: {
    type: 'ranged',
    role: 'tank',
    class: 'DRUID',
    label: 'Druid',
    name: 'Guardian',
  },
  105: {
    type: 'ranged',
    role: 'healer',
    class: 'DRUID',
    label: 'Druid',
    name: 'Restoration',
  },
  1467: {
    type: 'ranged',
    role: 'damage',
    class: 'EVOKER',
    label: 'Evoker',
    name: 'Devastation',
  },
  1468: {
    type: 'ranged',
    role: 'healer',
    class: 'EVOKER',
    label: 'Evoker',
    name: 'Preservation',
  },
  1473: {
    type: 'ranged',
    role: 'damage',
    class: 'EVOKER',
    label: 'Evoker',
    name: 'Augmentation',
  },
  253: {
    type: 'ranged',
    role: 'damage',
    class: 'HUNTER',
    label: 'Hunter',
    name: 'Beast Mastery',
  },
  254: {
    type: 'ranged',
    role: 'damage',
    class: 'HUNTER',
    label: 'Hunter',
    name: 'Marksmanship',
  },
  255: {
    type: 'melee',
    role: 'damage',
    class: 'HUNTER',
    label: 'Hunter',
    name: 'Survival',
  },
  62: {
    type: 'ranged',
    role: 'damage',
    class: 'MAGE',
    label: 'Mage',
    name: 'Arcane',
  },
  63: {
    type: 'ranged',
    role: 'damage',
    class: 'MAGE',
    label: 'Mage',
    name: 'Fire',
  },
  64: {
    type: 'ranged',
    role: 'damage',
    class: 'MAGE',
    label: 'Mage',
    name: 'Frost',
  },
  268: {
    type: 'melee',
    role: 'tank',
    class: 'MONK',
    label: 'Monk',
    name: 'Brewmaster',
  },
  269: {
    type: 'melee',
    role: 'damage',
    class: 'MONK',
    label: 'Monk',
    name: 'Windwalker',
  },
  270: {
    type: 'melee',
    role: 'healer',
    class: 'MONK',
    label: 'Monk',
    name: 'Mistweaver',
  },
  65: {
    type: 'melee',
    role: 'healer',
    class: 'PALADIN',
    label: 'Paladin',
    name: 'Holy',
  },
  66: {
    type: 'melee',
    role: 'tank',
    class: 'PALADIN',
    label: 'Paladin',
    name: 'Protection',
  },
  70: {
    type: 'melee',
    role: 'damage',
    class: 'PALADIN',
    label: 'Paladin',
    name: 'Retribution',
  },
  256: {
    type: 'ranged',
    role: 'healer',
    class: 'PRIEST',
    label: 'Priest',
    name: 'Discipline',
  },
  257: {
    type: 'ranged',
    role: 'healer',
    class: 'PRIEST',
    label: 'Priest',
    name: 'Holy',
  },
  258: {
    type: 'ranged',
    role: 'damage',
    class: 'PRIEST',
    label: 'Priest',
    name: 'Shadow',
  },
  259: {
    type: 'melee',
    role: 'damage',
    class: 'ROGUE',
    label: 'Rogue',
    name: 'Assassination',
  },
  260: {
    type: 'melee',
    role: 'damage',
    class: 'ROGUE',
    label: 'Rogue',
    name: 'Outlaw',
  },
  261: {
    type: 'melee',
    role: 'damage',
    class: 'ROGUE',
    label: 'Rogue',
    name: 'Subtlety',
  },
  262: {
    type: 'ranged',
    role: 'damage',
    class: 'SHAMAN',
    label: 'Shaman',
    name: 'Elemental',
  },
  263: {
    type: 'melee',
    role: 'damage',
    class: 'SHAMAN',
    label: 'Shaman',
    name: 'Enhancement',
  },
  264: {
    type: 'ranged',
    role: 'healer',
    class: 'SHAMAN',
    label: 'Shaman',
    name: 'Restoration',
  },
  265: {
    type: 'ranged',
    role: 'damage',
    class: 'WARLOCK',
    label: 'Warlock',
    name: 'Affliction',
  },
  266: {
    type: 'ranged',
    role: 'damage',
    class: 'WARLOCK',
    label: 'Warlock',
    name: 'Demonology',
  },
  267: {
    type: 'ranged',
    role: 'damage',
    class: 'WARLOCK',
    label: 'Warlock',
    name: 'Destruction',
  },
  71: {
    type: 'melee',
    role: 'damage',
    class: 'WARRIOR',
    label: 'Warrior',
    name: 'Arms',
  },
  72: {
    type: 'melee',
    role: 'damage',
    class: 'WARRIOR',
    label: 'Warrior',
    name: 'Fury',
  },
  73: {
    type: 'melee',
    role: 'tank',
    class: 'WARRIOR',
    label: 'Warrior',
    name: 'Protection',
  },
};

// Need this only for BG spec detection in retail.
// These spells should be common, and unique to a spec.
// More than one may be added per spec to improve chance of identifying.
const retailUniqueSpecSpells: StringKeyToNumberValueMapType = {
  'Heart Strike': 250,
  'Frost Strike': 251,
  'Festering Strike': 252,
  'Eye Beam': 577,
  'Fel Devastation': 581,
  Starfall: 102,
  "Tiger's Fury": 103,
  Maul: 104,
  Lifebloom: 105,
  Pyre: 1467,
  Echo: 1468,
  'Ebon Might': 1473,
  'Cobra Shot': 253,
  'Aimed Shot': 254,
  'Raptor Strike': 255,
  'Arcane Barrage': 62,
  Pyroblast: 63,
  'Ice Lance': 64,
  'Keg Smash': 268,
  'Fists of Fury': 269,
  'Enveloping Mist': 270,
  'Holy Shock': 65,
  "Avenger's Shield": 66,
  'Blade of Justice': 70,
  Penance: 256,
  'Holy Word: Serenity': 257,
  'Devouring Plague': 258,
  Mutilate: 259,
  'Sinister Strike': 260,
  'Shadow Dance': 261,
  'Earth Shock': 262,
  Stormstrike: 263,
  Riptide: 264,
  'Malefic Rapture': 265,
  'Call Dreadstalkers': 266,
  'Chaos Bolt': 267,
  'Mortal Strike': 71,
  Bloodthirst: 72,
  'Ignore Pain': 73,
};

// Need this for any non-raid spec detection in classic. More than one may be
// added per spec to improve chance of identifying.
//
// These spells MUST be unique to the spec. Ideally they also are common so they
// are more likely to be cast by the combatants, giving us higher chance at
// identifying the spec. Obviously some risk they cast nothing so we can't be
// perfect here.
//
// Some ordering conditions in how we identify combatants with a crawling mechanism
// means we won't always react if we see one of these spells, so again; make these
// common spells if possible.
const classicUniqueSpecSpells: StringKeyToNumberValueMapType = {
  'Heart Strike': 250,
  'Howling Blast': 251,
  'Summon Gargoyle': 252,
  Starfall: 102,
  Mangle: 103,
  Swiftmend: 105,
  Nourish: 105,
  Lifebloom: 105,
  'Bestial Wrath': 253,
  'Chimera Shot': 254,
  'Explosive Shot': 255,
  'Arcane Barrage': 62,
  "Dragon's Breath": 63,
  Combustion: 63,
  'Ice Barrier': 64,
  'Deep Freeze': 64,
  'Holy Shock': 65,
  "Avenger's Shield": 66,
  'Crusader Strike': 70, // in classic rets are 67 but use 70 for consistency with retail
  Penance: 256,
  'Guardian Spirit': 257,
  'Vampiric Touch': 258,
  Mutilate: 259,
  'Killing Spree': 260, // might be wrong? assumed combatID === outlawID
  Shadowstep: 261,
  'Lava Burst': 262,
  Thunderstorm: 262,
  'Feral Spirit': 263,
  Riptide: 264,
  Haunt: 265,
  Metamorphosis: 266,
  'Chaos Bolt': 267,
  'Mortal Strike': 71,
  Bloodthirst: 72,
  Shockwave: 73,
};

// Used in addition to the spells above to detect specs in classic. The same
// logic applies here; these should be spec unique auras.
const classicUniqueSpecAuras: StringKeyToNumberValueMapType = {
  'Borrowed Time': 256,
  'Unstable Affliction': 265,
  'The Art of War': 70, // in classic rets are 67 but use 70 for consistency with retail
};

// Taken from https://wago.tools/db2/MapChallengeMode?build=11.0.2.55789.
const mopChallengeModes: Record<number, string> = {
  2: 'Temple of the Jade Serpent',
  56: 'Stormstout Brewery',
  57: 'Gate of the Setting Sun',
  58: 'Shado-Pan Monastery',
  59: 'Siege of Niuzao Temple',
  60: "Mogu'shan Palace",
  76: 'Scholomance',
  77: 'Scarlet Halls',
  78: 'Scarlet Monastery',
};

// Gold, silver, bronze timers for Mists of Pandaria challenge
// modes. Taken from in-game Challenges panel.
const mopChallengeModesTimers: Record<number, number[]> = {
  2: [45, 25, 15], // Temple of the Jade Serpent
  56: [45, 21, 12], // Stormstout Brewery
  57: [45, 22, 13], // Gate of the Setting Sun
  58: [60, 35, 21], // Shado-Pan Monastery
  59: [50, 30, 17.5], // Siege of Niuzao Temple
  60: [45, 21, 12], // Mogu'shan Palace
  76: [55, 33, 19], // Scholomance
  77: [45, 25, 13], // Scarlet Halls
  78: [45, 22, 13], // Scarlet Monastery
};

export {
  months,
  categoryTabSx,
  categoryTabsSx,
  videoButtonSx,
  zones,
  retailArenas,
  classicArenas,
  raidEncountersById,
  retailBattlegrounds,
  classicBattlegrounds,
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
  raidInstances,
  categoryRecordingSettings,
  classicUniqueSpecSpells,
  classicUniqueSpecAuras,
  retailUniqueSpecSpells,
  obsResolutions,
  WoWCharacterClassType,
  WoWClassColor,
  scrollBarSx,
  currentRetailEncounters,
  mopChallengeModes,
  mopChallengeModesTimers,
};
