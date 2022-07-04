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
 * Zones by ID. 
 */
const zones: { [id: number]: string; } = {
    // Arenas (Zone IDs)
    1672: "Blade's Edge Arena",
    617: "Dalaran Arena",
    1505: "Nagrand Arena",
    572: "Ruins of Lordaeron",
    2167: "The Robodrome",
    1134: "Tiger's Peak",
    980: "Tol'Viron Arena",
    1504: "Black Rook Hold Arena",
    2373: "Empyrean Domain",
    1552: "Ashamane's Fall",
    1911: "Mugambala",
    1825: "Hook Point",
    2509: "Maldraxxus Coliseum",
    2547: "Enigma Crucible",

    // Raids (Encounter IDs)
    2537: "The Jailer",
    2512: "Vigilant Guardian",
    2529: "Halondrus the Reclaimer",
    2539: "Lihuvim, Principal Architect",
    2540: "Dausegne, the Fallen Oracle",
    2542: "Skolex, the Insatiable Ravener",
    2543: "Lords of Dread",
    2544: "Prototype Pantheon",
    2546: "Anduin Wrynn",
    2549: "Rygelon",
    2553: "Artificer Xy'mox",

    // Dungeons (Zone IDs)
    2291: "De Other Side",
    2287: "Halls of Atonement",
    2290: "Mists of Tirna Scithe",
    2289: "Plaguefall",
    2284: "Sanguine Depths",
    2285: "Spires of Ascension",
    2286: "The Necrotic Wake",
    2293: "Theater of Pain",
    2441: "Tazavesh the Veiled Market",
    
    // Battlegrounds (Zone IDs)
    30:	  "Alterac Valley",
    2107: "Arathi Basin",
    1681: "Arathi Basin",
    1105: "Deepwind Gorge",
    566:  "Eye of the Storm",
    968:  "Eye of the Storm",
    628:  "Isle of Conquest",
    1803: "Seething Shore",
    727:  "Silvershard Mines",
    607:  "Strand of the Ancients",
    998:  "Temple of Kotmogu",
    761:  "The Battle for Gilneas",
    726:  "Twin Peaks",
    489:  "Warsong Gulch"
}

export {
    categories,
    months,
    zones,
};

