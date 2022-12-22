import { VideoCategory } from '../main/constants';
import ArenaMatch from '../activitys/ArenaMatch';
import { Combatant } from "../main/combatant";
import { Flavour, PlayerDeathType } from '../main/types';
import { IArenaMatch } from 'wow-combat-log-parser';

const testCombatants = [
    new Combatant("Player-1092-0A70E103", 1, 557),
    new Combatant("Player-580-0A3E1BD5",  1, 105),
    new Combatant("Player-1329-09C34603", 0, 253),
    new Combatant("Player-1084-08A89569", 0, 256),
    new Combatant("Player-1084-07D10085", 1, 261),
    new Combatant("Player-3674-05ABF767", 0, 71 ),
] 

const testDeaths: PlayerDeathType[] = [
    { name: "Alexsmite", specId: 253, timestamp: 290, friendly: true },
    { name: "Dogson", specId: 256, timestamp: 300, friendly: true },
    { name: "Anotherguy", specId: 256, timestamp: 300, friendly: true },
]

test('Test Retail 2v2', () => {
    testRetailArena(VideoCategory.TwoVTwo, 4, 2, 0);
    testRetailArena(VideoCategory.TwoVTwo, 4, 2, 0);
})

test('Test Retail 3v3', () => {
    testRetailArena(VideoCategory.ThreeVThree, 6, 3, 0);
    testRetailArena(VideoCategory.ThreeVThree, 6, 3, 1);
})

test('Test Retail Skirmish', () => {
    testRetailArena(VideoCategory.Skirmish, 4, 2, 0);
    testRetailArena(VideoCategory.Skirmish, 4, 1, 1);
    testRetailArena(VideoCategory.Skirmish, 6, 0, 0);
    testRetailArena(VideoCategory.Skirmish, 6, 0, 1);
})

const testRetailArena = (category: VideoCategory, 
                         numberCombatants: number, 
                         numberDeaths: number, 
                         winningTeamID: number) => 
{
    const startDate = new Date('2022-12-25T12:00:00');
    const zoneID = 1672;
    
    const arenaMatch = new ArenaMatch(startDate, 
                                      category, 
                                      zoneID,
                                      Flavour.Retail, );

    let expectedCombatantMap = new Map();
    let expectedDeaths = [];

    for (let i = 0; i < numberCombatants; i++) {
        arenaMatch.addCombatant(testCombatants[i]);
        expectedCombatantMap.set(testCombatants[i].GUID, testCombatants[i]);
    }

    arenaMatch.playerGUID = testCombatants[0].GUID;

    for (let i = 0; i < numberDeaths; i++) {
        arenaMatch.addDeath(testDeaths[i]);
        expectedDeaths.push(testDeaths[i]);
    }

    const endDate = new Date('2022-12-25T12:05:00');
    arenaMatch.endArena({
        endTime: endDate.getDate(),
        endInfo: {
            winningTeamId: `${winningTeamID}`
        } as any
    } as IArenaMatch);

    const actualMetadata = arenaMatch.getMetadata();
    const expectedDuration = (endDate.getTime() - startDate.getTime()) / 1000;
    const expectedResult = (winningTeamID === testCombatants[0].teamID);

    const expectedMetadata = {
        category: category,
        zoneID: zoneID,
        duration: expectedDuration,
        result: expectedResult,
        deaths: expectedDeaths,
        player: new Combatant(testCombatants[0].GUID, 
                              testCombatants[0].teamID, 
                              testCombatants[0].specID)
    };

    expect(arenaMatch.startDate).toBe(startDate);
    expect(arenaMatch.endDate).toBe(endDate);
    expect(arenaMatch.duration).toBe(expectedDuration);

    expect(arenaMatch.category).toBe(category);
    expect(arenaMatch.result).toBe(expectedResult);
    expect(arenaMatch.zoneID).toBe(zoneID);
    expect(arenaMatch.playerGUID).toBe(testCombatants[0].GUID);

    expect(arenaMatch.combatantMap).toStrictEqual(expectedCombatantMap);
    expect(arenaMatch.deaths).toStrictEqual(expectedDeaths);
    expect(actualMetadata).toStrictEqual(expectedMetadata);
}