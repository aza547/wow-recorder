/**
 * List of supported categories. Order is the order they show up in the GUI.
 */
enum VideoCategory {
  TwoVTwo = '2v2',
  ThreeVThree = '3v3',
  Skirmish = 'Skirmish',
  SoloShuffle = 'Solo Shuffle',
  MythicPlus = 'Mythic+',
  Raids = 'Raids',
  Battlegrounds = 'Battlegrounds',
};

const categories: string[] = [
  VideoCategory.TwoVTwo,
  VideoCategory.ThreeVThree,
  VideoCategory.Skirmish,
  VideoCategory.SoloShuffle,
  VideoCategory.MythicPlus,
  VideoCategory.Raids,
  VideoCategory.Battlegrounds,
];

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
 const battlegrounds: { [id: number]: string; } = {
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
 const arenas: { [id: number]: string; } = {
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
 * Encounters by ID.  
 */
const encountersSepulcher: { [id: number]: string; } = {
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

const encountersSanctum: { [id: number]: string; } = {
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

const encountersNathria: { [id: number]: string; } = {
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

const raids: { [id: number]: string; } = {
  ...encountersNathria,
  ...encountersSanctum,
  ...encountersSepulcher
}

/**
 * Dungeons by ID. 
 */
 const dungeons: { [id: number]: string; } = {
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

const dungeonEncounters: { [id: number]: string } = {
  1715: 'Rocketspark and Borka',
  1732: 'Nitrogg Thundertower',
  1736: 'Skylord Tovra',
  1748: 'Grimrail Enforcers',
  1749: "Fleshrender Nok'gar",
  1750: 'Oshir',
  1754: 'Skulloc, Son of Gruul',
  1790: 'Rokmora',
  1791: 'Ularogg Cragshaper',
  1792: 'Naraxas',
  1793: 'Dargrul the Underking',
  1954: 'Maiden of Virtue',
  1957: 'Opera Hall',
  1959: 'Mana Devourer',
  1960: 'Attumen the Huntsman',
  1961: 'Moroes',
  1964: 'The Curator',
  1965: 'Shade of Medivh',
  2017: "Viz'aduum the Watcher",
  2257: 'Tussle Tonks',
  2258: 'K.U.-J.0.',
  2259: "Machinist's Garden",
  2260: 'King Mechagon',
  2290: 'King Gobbamak',
  2291: 'HK-8 Aerial Oppression Unit',
  2292: 'Gunker',
  2312: 'Trixie & Naeno',
  2356: 'Ventunax',
  2357: 'Kin-Tara',
  2358: 'Oryphrion',
  2359: 'Devos, Paragon of Loyalty',
  2360: 'Kryxis the Voracious',
  2361: 'Executor Tarvold',
  2362: 'Grand Proctor Beryllia',
  2363: 'General Kaal',
  2364: "Kul'tharok",
  2365: 'Gorechop',
  2366: 'Xav the Unfallen',
  2380: 'Echelon',
  2381: 'Lord Chamberlain',
  2382: 'Globgrog',
  2384: 'Doctor Ickus',
  2385: 'Domina Venomblade',
  2386: 'Stradama Margrave',
  2387: 'Blightbone',
  2388: 'Amarth  The Harvester',
  2389: 'Surgeon Stitchflesh',
  2390: 'Nalthor the Rimebinder',
  2391: 'An Affront of Challengers',
  2392: 'Mistcaller',
  2393: "Tred'ova",
  2394: 'The Manastorms',
  2395: 'Hakkar, the Soulflayer',
  2396: "Mueh'zala",
  2397: 'Ingra Maloch',
  2400: "Dealer Xy'exa",
  2401: 'Halkias, the Sin-Stained Goliath',
  2403: 'High Adjudicator Aleez',
  2404: 'Mordretha',
  2419: "Timecap'n Hooktail",
  2424: 'Mailroom Mayhem',
  2425: "Zo'phex the Sentinel",
  2426: 'Hylbrande',
  2437: "So'azmi",
  2440: "Myza's Oasis",
  2441: 'The Grand Menagerie',
  2442: "So'leah",
};

const dungeonAffixesById: { [id: number]: string } = {
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
const zones: { [id: number]: string; } = {
    ...arenas,
    ...raids,
    ...battlegrounds,
    ...dungeons,
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

const specToClass: { [id: number]: string; } = {
  250: "DEATHKNIGHT",
  251: "DEATHKNIGHT",
  252: "DEATHKNIGHT",
  577: "DEMONHUNTER",
  581: "DEMONHUNTER",
  102: "DRUID",
  103: "DRUID",
  104: "DRUID",
  105: "DRUID",
  253: "HUNTER",
  254: "HUNTER",
  255: "HUNTER",
  62:  "MAGE",
  63:  "MAGE",
  64:  "MAGE",
  268: "MONK",
  270: "MONK",
  269: "MONK",
  65:  "PALADIN",
  66:  "PALADIN",
  70:  "PALADIN",
  256: "PRIEST",
  257: "PRIEST",
  258: "PRIEST",
  259: "ROGUE",
  260: "ROGUE",
  261: "ROGUE",
  262: "SHAMAN",
  263: "SHAMAN",
  264: "SHAMAN",
  265: "WARLOCK",
  266: "WARLOCK",
  267: "WARLOCK",
  71:  "WARRIOR",
  72:  "WARRIOR",
  73:  "WARRIOR"
}

export {
    VideoCategory,
    categories,
    months,
    videoTabsSx,
    categoryTabSx,
    categoryTabsSx,
    videoButtonSx,
    zones,
    arenas,
    raids,
    battlegrounds,
    dungeons,
    dungeonAffixesById,
    dungeonEncounters,
    specToClass,
    encountersSanctum,
    encountersNathria,
    encountersSepulcher,
};