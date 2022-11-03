import { VideoCategory } from '../main/constants';
import ArenaMatch from '../activitys/ArenaMatch';
import { Combatant } from "../main/combatant";
import { PlayerDeathType } from '../main/types';

const testCombatants = [
    new Combatant("Player-1092-0A70E103", 1, 557),
    new Combatant("Player-580-0A3E1BD5",  1, 105),
    new Combatant("Player-1329-09C34603", 0, 253),
    new Combatant("Player-1084-08A89569", 0, 256),
    new Combatant("Player-1084-07D10085", 1, 261),
    new Combatant("Player-3674-05ABF767", 0, 71 ),
] 

const testDeaths: PlayerDeathType[] = [
    { name: "Alexsmite", specId: 253, timestamp: 290 },
    { name: "Dogson", specId: 256, timestamp: 300 },
    { name: "Anotherguy", specId: 256, timestamp: 300 },
]

test('Test 2v2', () => {
    testArena(VideoCategory.TwoVTwo, 4, 2, 0);
    testArena(VideoCategory.TwoVTwo, 4, 2, 0);
})

test('Test 3v3', () => {
    testArena(VideoCategory.ThreeVThree, 6, 3, 0);
    testArena(VideoCategory.ThreeVThree, 6, 3, 1);
})

test('Test Skirmish', () => {
    testArena(VideoCategory.Skirmish, 4, 2, 0);
    testArena(VideoCategory.Skirmish, 4, 1, 1);
    testArena(VideoCategory.Skirmish, 6, 0, 0);
    testArena(VideoCategory.Skirmish, 6, 0, 1);
})

const testArena = (category: VideoCategory, 
                   numberCombatants: number, 
                   numberDeaths: number, 
                   winningTeamID: number) => 
{
    const startDate = new Date('2022-12-25T12:00:00');
    const zoneID = 1672;
    const arenaMatch = new ArenaMatch(startDate, category, zoneID);
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
    arenaMatch.endArena(endDate, winningTeamID);

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