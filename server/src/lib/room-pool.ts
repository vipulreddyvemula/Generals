import { Room, RoomPool } from './types';
import { EVENT_LIMITS } from './event-limits';

export const roomPool: RoomPool = Object.create(null);

export const MAX_ROOM_COUNT = EVENT_LIMITS.maxRooms;
let roomCount = 0;

export async function createRoom(
  roomId: string = '',
  roomName: string = 'Untitled'
) {
  try {
    if (Object.keys(roomPool).length >= MAX_ROOM_COUNT)
      throw new Error('Room count exceeded');
    if (!roomId) {
      ++roomCount;
      roomId = String(roomCount + 1);
    }
    const newRoom = new Room(roomId, roomName);
    newRoom.maxPlayers = Math.min(newRoom.maxPlayers, EVENT_LIMITS.maxPlayersPerRoom);
    roomPool[roomId] = newRoom;
    return {
      success: true,
      roomId: roomId,
    };
  } catch (e: any) {
    console.error(JSON.stringify(e, ["message", "arguments", "type", "name"]));
    return {
      success: false,
      message: e.message,
    };
  }
}

// Bot
roomPool['1'] = Room.create({
  id: '1',
  roomName: 'Bot Room',
  keepAlive: true,
});
roomPool['1'].maxPlayers = Math.min(roomPool['1'].maxPlayers, EVENT_LIMITS.maxPlayersPerRoom);

// Warring state
roomPool['warring_state'] = Room.create({
  id: 'warring_state',
  roomName: 'Warring States Mode',
  warringStatesMode: true,
  revealKing: true,
  keepAlive: true,
});
roomPool['warring_state'].maxPlayers = Math.min(roomPool['warring_state'].maxPlayers, EVENT_LIMITS.maxPlayersPerRoom);

// mobile
// roomPool['mobile'] = Room.create({
//   id: 'mobile',
//   roomName: '手机房 Mobile Room',
//   mapWidth: 0.9,
//   mapHeight: 0.4,
//   keepAlive: true,
// });
