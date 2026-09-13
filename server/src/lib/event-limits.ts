import { ColorArr, forceStartOK, MaxTeamNum } from './constants';
import { Room, RoomPool } from './types';

export function configuredInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

export const HARD_PLAYER_LIMIT_PER_ROOM = Math.min(ColorArr.length - 1, MaxTeamNum, forceStartOK.length - 1);

export const EVENT_LIMITS = Object.freeze({
  maxRooms: configuredInteger('MAX_ROOMS', 160, 2, 1000),
  maxTotalPlayers: configuredInteger('MAX_TOTAL_PLAYERS', 300, 2, 2000),
  maxPlayersPerRoom: configuredInteger('MAX_PLAYERS_PER_ROOM', HARD_PLAYER_LIMIT_PER_ROOM, 2, HARD_PLAYER_LIMIT_PER_ROOM),
});

export function countRoomPlayers(pool: RoomPool): number {
  return Object.values(pool).reduce((total, room) => total + room.players.length, 0);
}

export function canJoinRoom(pool: RoomPool, room: Room): boolean {
  return (
    room.players.length < room.maxPlayers &&
    room.players.length < EVENT_LIMITS.maxPlayersPerRoom &&
    countRoomPlayers(pool) < EVENT_LIMITS.maxTotalPlayers
  );
}
