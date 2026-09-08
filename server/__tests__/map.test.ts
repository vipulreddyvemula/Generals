import Map from '../src/lib/map';
import Player from '../src/lib/player';

describe('Map Engine Smoke Test', () => {
  it('should initialize a map correctly', () => {
    const map = new Map('map1', 'test_map', 10, 10, 0, 0, 0, [], false);
    expect(map.width).toBe(10);
    expect(map.height).toBe(10);
  });

  it('should allow adding a player', () => {
    const player = new Player('user1', 'socket1', 'player1', 1, 1);
    const map = new Map('map1', 'test_map', 10, 10, 0, 0, 0, [player], false);
    expect(player.username).toBe('player1');
  });
});
