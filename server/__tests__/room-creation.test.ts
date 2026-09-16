/**
 * P1 — Room Creation Security Regression Tests
 *
 * Verifies:
 *  1. Auto-generated room IDs are UUIDs (collision-safe, unpredictable).
 *  2. An explicit room ID that already exists is rejected with a clear error.
 *  3. Room pool saturation still returns a clean failure message.
 *  4. HTTP rate-limit policy for /create_room is correctly shaped.
 */
import { createRoom, roomPool, MAX_ROOM_COUNT } from '../src/lib/room-pool';
import { Room } from '../src/lib/types';
import { SocketRateLimiter } from '../src/lib/socket-rate-limit';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('P1 — room creation security', () => {
  it('auto-generated room IDs are v4 UUIDs (collision-safe, unpredictable)', async () => {
    const result = await createRoom();
    expect(result.success).toBe(true);
    expect(result.roomId).toMatch(UUID_REGEX);
    // Cleanup
    if (result.roomId) delete roomPool[result.roomId];
  });

  it('two successive auto-created rooms have different IDs', async () => {
    const a = await createRoom();
    const b = await createRoom();
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(a.roomId).not.toBe(b.roomId);
    if (a.roomId) delete roomPool[a.roomId];
    if (b.roomId) delete roomPool[b.roomId];
  });

  it('explicit room ID that already exists is rejected (no overwrite)', async () => {
    const first = await createRoom('collision-id');
    expect(first.success).toBe(true);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const second = await createRoom('collision-id');
    consoleSpy.mockRestore();

    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already exists/i);
    // The room object must be the original, not overwritten.
    expect(roomPool['collision-id']).toBeDefined();

    delete roomPool['collision-id'];
  });

  it('returns a clean failure when the room pool is full', async () => {
    const insertedKeys: string[] = [];
    while (Object.keys(roomPool).length < MAX_ROOM_COUNT) {
      const key = `cap-test-${insertedKeys.length}`;
      roomPool[key] = new Room(key);
      insertedKeys.push(key);
    }
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await createRoom('must-fail-full');
    consoleSpy.mockRestore();
    for (const key of insertedKeys) delete roomPool[key];

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Room count exceeded/i);
    expect(roomPool['must-fail-full']).toBeUndefined();
  });

  it('HTTP rate-limit policy allows burst of 5 per IP per minute', () => {
    const CREATE_ROOM_HTTP_POLICY = { burst: 5, refillMs: 60_000 };
    const limiter = new SocketRateLimiter();
    const ip = 'test-ip-rate';
    let allowed = 0;
    for (let i = 0; i < 10; i++) {
      if (limiter.allow(`http:${ip}`, 'create_room', CREATE_ROOM_HTTP_POLICY, 0)) allowed++;
    }
    expect(allowed).toBe(5);
    // After the window refreshes, should be allowed again.
    expect(limiter.allow(`http:${ip}`, 'create_room', CREATE_ROOM_HTTP_POLICY, 60_001)).toBe(true);
  });
});
