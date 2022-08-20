/**
 * List of supported categories. Order is the order they show up in the GUI.
 */
const categories: string[]  = [
    "2v2",
    "3v3",
    "Skirmish",
    "Solo Shuffle",
    "Mythic+",
    "Raids",
    "Battlegrounds"
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
  489:  "Warsong Gulch"
}

/**
 * Arenas by ID. 
 */
 const arenas: { [id: number]: string; } = {
  1672: "Blade's Edge",
  617: "Dalaran",
  1505: "Nagrand",
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
 const raids: { [id: number]: string; } = {
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
 * Dungeons by ID. 
 */
 const dungeons: { [id: number]: string; } = {
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
    specToClass
};