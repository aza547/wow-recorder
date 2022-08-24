const getArenaImage = (id: number) => {
    return require(`../../assets/arena/${id}.jpg`);
}

const getDungeonImage = (id: number) => {
    return require(`../../assets/dungeon/${id}.jpg`);
}

const getRaidImage = (id: number) => {
    return require(`../../assets/raid/${id}.jpg`);
}

const getBattlegroundImage = (id: number) => {
    return require(`../../assets/battlegrounds/${id}.jpg`);
}

const getSpecImage = (id: number) => {
    return require(`../../assets/specs/${id}.png`);
}

const arena = {
    1672: getArenaImage(1672),
    617:  getArenaImage(617),
    1505: getArenaImage(1505),
    572:  getArenaImage(572),
    2167: getArenaImage(2167),
    1134: getArenaImage(1134), 
    980:  getArenaImage(980), 
    1504: getArenaImage(1504), 
    2373: getArenaImage(2373),
    1552: getArenaImage(1552), 
    1911: getArenaImage(1911),
    1825: getArenaImage(1825),
    2509: getArenaImage(2509),
    2547: getArenaImage(2547),
}

const dungeon = {
    2293: getDungeonImage(2293),
    2441: getDungeonImage(2441),
    2287: getDungeonImage(2287),
    2286: getDungeonImage(2286),
    2258: getDungeonImage(2258),
    2289: getDungeonImage(2289),
    2284: getDungeonImage(2284),
    2291: getDungeonImage(2291),
    2290: getDungeonImage(2290),
}

const raid = {
    2512: getRaidImage(2512),
    2537: getRaidImage(2537),
    2539: getRaidImage(2539),
    2540: getRaidImage(2540),
    2542: getRaidImage(2542),
    2543: getRaidImage(2543),
    2544: getRaidImage(2544),
    2546: getRaidImage(2546),
    2549: getRaidImage(2549),
    2553: getRaidImage(2553),
    2529: getRaidImage(2529),
}


const battleground = {
    2107: getBattlegroundImage(2107),
    1681: getBattlegroundImage(1681),
    30:   getBattlegroundImage(30),
    761:  getBattlegroundImage(761),
    1105: getBattlegroundImage(1105),
    2245: getBattlegroundImage(2245),
    566:  getBattlegroundImage(566),
    968:  getBattlegroundImage(968),
    628:  getBattlegroundImage(628),
    727:  getBattlegroundImage(727),
    1803: getBattlegroundImage(1803),
    998:  getBattlegroundImage(998),
    726:  getBattlegroundImage(726),
    489:  getBattlegroundImage(489),
}

const spec = {
    0: require("../../assets/icon/wowNotFound.png"),
    250: getSpecImage(250),
    251: getSpecImage(251),
    252: getSpecImage(252),
    577: getSpecImage(577),
    581: getSpecImage(581),
    102: getSpecImage(102),
    103: getSpecImage(103),
    104: getSpecImage(104),
    105: getSpecImage(105),
    253: getSpecImage(253),
    254: getSpecImage(254),
    255: getSpecImage(255),
    62: getSpecImage(62),
    63: getSpecImage(63),
    64: getSpecImage(64),
    268: getSpecImage(268),
    270: getSpecImage(270),
    269: getSpecImage(269),
    65: getSpecImage(65),
    66: getSpecImage(66),
    70: getSpecImage(70),
    256: getSpecImage(256),
    257: getSpecImage(257),
    258: getSpecImage(258),
    259: getSpecImage(259),
    260: getSpecImage(260),
    261: getSpecImage(261),
    262: getSpecImage(262),
    263: getSpecImage(263),
    264: getSpecImage(264),
    265: getSpecImage(265),
    266: getSpecImage(266),
    267: getSpecImage(267),
    71: getSpecImage(71),
    72: getSpecImage(72),
    73: getSpecImage(73),
}

export {
    arena,
    dungeon,
    raid,
    battleground,
    spec
}