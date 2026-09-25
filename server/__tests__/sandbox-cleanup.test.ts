import { addDummyBotToRoom, isDummyBot } from '../src/lib/dummy-bot';
import { cancelReconnectGrace, hasHumanParticipants, isRoomAbandoned, scheduleReconnectGrace } from '../src/lib/lifecycle';
import Player from '../src/lib/player';
import { Room } from '../src/lib/types';

describe('tutorial sandbox abandonment', () => {
  it('treats a bot-only disposable sandbox as abandoned', () => {
    const room = new Room('sandbox');
    room.isSandbox = true;
    const bot = addDummyBotToRoom(room);

    expect(bot).not.toBeNull();
    expect(isDummyBot(bot!)).toBe(true);
    expect(hasHumanParticipants(room)).toBe(false);
    expect(isRoomAbandoned(room)).toBe(true);
  });

  it('keeps a sandbox while a human seat is present, including reconnect grace', () => {
    const room = new Room('sandbox-with-human');
    room.isSandbox = true;
    addDummyBotToRoom(room);
    const human = new Player('human-player', 'socket-human', 'Practice Opponent', 3, 3);
    room.players.push(human);

    expect(hasHumanParticipants(room)).toBe(true);
    expect(isRoomAbandoned(room)).toBe(false);
    scheduleReconnectGrace(human, jest.fn(), 120_000);
    expect(isRoomAbandoned(room)).toBe(false);

    cancelReconnectGrace(human);
    room.players = room.players.filter((player) => player !== human);
    expect(isRoomAbandoned(room)).toBe(true);
  });

  it('never collects a keep-alive room even if it contains only a dummy bot', () => {
    const room = new Room('keep-alive');
    room.keepAlive = true;
    addDummyBotToRoom(room);

    expect(hasHumanParticipants(room)).toBe(false);
    expect(isRoomAbandoned(room)).toBe(false);
  });
});
