import { ColorArr, forceStartOK, MaxTeamNum, SpeedOptions } from './constants';
import { neutralizePlayer } from './lifecycle';
import Player from './player';
import Point from './point';
import { Room } from './types';

export const MAX_SUPPORTED_PLAYERS = Math.min(ColorArr.length - 1, MaxTeamNum, forceStartOK.length - 1);

export const ROOM_SETTING_KEYS = [
  'roomName',
  'mapId',
  'maxPlayers',
  'gameSpeed',
  'mapWidth',
  'mapHeight',
  'mountain',
  'city',
  'swamp',
  'fogOfWar',
  'revealKing',
  'warringStatesMode',
  'deathSpectator',
] as const;

export type RoomSettingKey = (typeof ROOM_SETTING_KEYS)[number];
export type RoomSettingValue = string | number | boolean;
export interface AuthorizedRoomSetting {
  player: Player;
  property: RoomSettingKey;
  value: RoomSettingValue;
}

export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; code: string; message: string };

export function resolveSocketPlayer(room: Room, socketId: string): Player | null {
  return room.players.find((player) => player.socket_id === socketId && !player.disconnected) || null;
}

export function surrenderForSocket(room: Room, socketId: string): ActionResult<Player> {
  if (!room.gameStarted || !room.map) {
    return { ok: false, code: 'MATCH_NOT_ACTIVE', message: 'The match is not active.' };
  }
  const player = resolveSocketPlayer(room, socketId);
  if (!player || player.spectating()) {
    return { ok: false, code: 'NOT_AUTHORIZED', message: 'This session cannot surrender.' };
  }
  if (player.isDead) {
    return { ok: false, code: 'ALREADY_SURRENDERED', message: 'You have already surrendered.' };
  }
  neutralizePlayer(room, player);
  return { ok: true, value: player };
}

export function changeTeamForSocket(room: Room, socketId: string, team: unknown): ActionResult<Player> {
  const player = resolveSocketPlayer(room, socketId);
  if (!player) return { ok: false, code: 'NOT_AUTHORIZED', message: 'Player session not found.' };
  if (room.gameStarted) {
    return { ok: false, code: 'MATCH_STARTED', message: 'Teams are locked after the match starts.' };
  }
  if (!Number.isInteger(team) || (team as number) <= 0 || (team as number) > MaxTeamNum + 1) {
    return {
      ok: false,
      code: 'INVALID_TEAM',
      message: `Team must be between 1 and ${MaxTeamNum}, or spectators.`,
    };
  }

  player.team = team as number;
  if (player.spectating() && player.forceStart) {
    player.forceStart = false;
    room.forceStartNum = Math.max(0, room.forceStartNum - 1);
  }
  return { ok: true, value: player };
}

export function isOrthogonalMove(from: Point, to: Point): boolean {
  if (![from.x, from.y, to.x, to.y].every(Number.isInteger)) return false;
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) === 1;
}

export function validateRoomSetting(room: Room, property: string, value: unknown): ActionResult<RoomSettingValue> {
  if (!(ROOM_SETTING_KEYS as readonly string[]).includes(property)) {
    return { ok: false, code: 'SETTING_NOT_ALLOWED', message: 'This room setting cannot be changed.' };
  }

  switch (property as RoomSettingKey) {
    case 'roomName': {
      const roomName = typeof value === 'string' ? value.trim() : '';
      return roomName.length > 0 && roomName.length <= 20
        ? { ok: true, value: roomName }
        : { ok: false, code: 'INVALID_VALUE', message: 'Room name must contain 1–20 characters.' };
    }
    case 'mapId':
      return typeof value === 'string' && /^[A-Za-z0-9_-]{0,50}$/.test(value)
        ? { ok: true, value }
        : { ok: false, code: 'INVALID_VALUE', message: 'Map ID is invalid.' };
    case 'maxPlayers':
      return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 2 &&
        value <= MAX_SUPPORTED_PLAYERS &&
        value >= room.players.length
        ? { ok: true, value }
        : {
            ok: false,
            code: 'INVALID_VALUE',
            message: `Maximum players must be an integer from 2 to ${MAX_SUPPORTED_PLAYERS} and not below the current room size.`,
          };
    case 'gameSpeed':
      return typeof value === 'number' && SpeedOptions.includes(value)
        ? { ok: true, value }
        : { ok: false, code: 'INVALID_VALUE', message: 'Game speed is invalid.' };
    case 'mapWidth':
    case 'mapHeight':
    case 'mountain':
    case 'city':
    case 'swamp':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
        ? { ok: true, value }
        : { ok: false, code: 'INVALID_VALUE', message: `Map ${property} must be between 0 and 1.` };
    case 'fogOfWar':
    case 'revealKing':
    case 'warringStatesMode':
    case 'deathSpectator':
      return typeof value === 'boolean'
        ? { ok: true, value }
        : { ok: false, code: 'INVALID_VALUE', message: 'Expected a boolean value.' };
  }
}

export function authorizeRoomSettingForSocket(
  room: Room,
  socketId: string,
  property: string,
  value: unknown
): ActionResult<AuthorizedRoomSetting> {
  const player = resolveSocketPlayer(room, socketId);
  if (!player?.isRoomHost) {
    return { ok: false, code: 'NOT_HOST', message: 'You are not the game host.' };
  }
  if (room.gameStarted) {
    return { ok: false, code: 'MATCH_STARTED', message: 'Room settings are locked after the match starts.' };
  }
  const validation = validateRoomSetting(room, property, value);
  if (validation.ok === false) return validation;
  return {
    ok: true,
    value: {
      player,
      property: property as RoomSettingKey,
      value: validation.value,
    },
  };
}

export function applyRoomSetting(room: Room, property: RoomSettingKey, value: RoomSettingValue): void {
  switch (property) {
    case 'roomName':
    case 'mapId':
      room[property] = value as string;
      break;
    case 'maxPlayers':
    case 'gameSpeed':
    case 'mapWidth':
    case 'mapHeight':
    case 'mountain':
    case 'city':
    case 'swamp':
      room[property] = value as number;
      break;
    case 'fogOfWar':
    case 'revealKing':
    case 'warringStatesMode':
    case 'deathSpectator':
      room[property] = value as boolean;
      break;
  }
}
