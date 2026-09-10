import Map from '../src/lib/map';
import Player from '../src/lib/player';
import Point from '../src/lib/point';

describe('Commander Abilities Test', () => {
  it('Fortify should double defense for 16 turns and correctly deduct unit counts', () => {
    const player1 = new Player('user1', 'socket1', 'player1', 1, 1);
    const player2 = new Player('user2', 'socket2', 'player2', 2, 2);
    
    // Create map
    const map = new Map('map1', 'test_map', 10, 10, 0, 0, 0, [player1, player2], false);
    map.generate();
    
    // Set up blocks
    const p1Block = map.map[0][0]!;
    p1Block.player = player1;
    p1Block.unit = 10;
    p1Block.fortifyUntilTurn = 16; // Fortify active!

    const p2Block = map.map[0][1]!;
    p2Block.player = player2;
    p2Block.unit = 15;

    // Turn 1: Player 2 attacks fortified Player 1
    // P2 has 15, P1 has 10 fortified (effective 20).
    // 20 >= 15 is TRUE. P1 survives.
    // Remaining P1 effective: 20 - 15 = 5. Actual restored: Math.ceil(5 / 2) = 3.
    map.turn = 1;
    map.moveUnit(player2, 14, new Point(0, 1), new Point(0, 0)); // p2 moves 14 units (leaves 1)

    // Expected combat:
    // P1 defenseUnit = 10 * 2 = 20.
    // Attack unit = 14.
    // defenseUnit (20) >= attack unit (14) -> true.
    // defenseUnit = 20 - 14 = 6.
    // Restored actual = Math.ceil(6 / 2) = 3.
    expect(p1Block.player.id).toBe(player1.id);
    expect(p1Block.unit).toBe(3);
  });

  it('Fortify should correctly break when overpowered', () => {
    const player1 = new Player('user1', 'socket1', 'player1', 1, 1);
    const player2 = new Player('user2', 'socket2', 'player2', 2, 2);
    const map = new Map('map1', 'test_map', 10, 10, 0, 0, 0, [player1, player2], false);
    map.generate();
    
    const p1Block = map.map[0][0]!;
    p1Block.player = player1;
    p1Block.unit = 10;
    p1Block.fortifyUntilTurn = 16;

    const p2Block = map.map[0][1]!;
    p2Block.player = player2;
    p2Block.unit = 25;

    map.turn = 1;
    map.moveUnit(player2, 24, new Point(0, 1), new Point(0, 0));

    // P1 defense = 20. Attack = 24.
    // 20 < 24. P2 wins.
    // P2 remaining = 24 - 20 = 4.
    expect(p1Block.player.id).toBe(player2.id);
    expect(p1Block.unit).toBe(4);
    expect(p1Block.fortifyUntilTurn).toBe(0); // broken
  });
  
  it('Fortify should expire correctly by using this.turn in map move operations', () => {
    const player1 = new Player('user1', 'socket1', 'player1', 1, 1);
    const player2 = new Player('user2', 'socket2', 'player2', 2, 2);
    const map = new Map('map1', 'test_map', 10, 10, 0, 0, 0, [player1, player2], false);
    map.generate();
    
    const p1Block = map.map[0][0]!;
    p1Block.player = player1;
    p1Block.unit = 10;
    p1Block.fortifyUntilTurn = 16;

    const p2Block = map.map[0][1]!;
    p2Block.player = player2;
    p2Block.unit = 15;

    // Simulate turn 17 (fortify expired)
    map.turn = 17;
    map.moveUnit(player2, 14, new Point(0, 1), new Point(0, 0));

    // Normal combat: P1 has 10, P2 attacks with 14.
    // 10 < 14. P2 wins. Remaining = 14 - 10 = 4.
    expect(p1Block.player.id).toBe(player2.id);
    expect(p1Block.unit).toBe(4);
  });
});
