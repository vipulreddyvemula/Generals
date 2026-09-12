import Player from './player';
import { Room } from './types';

export interface GameOutcome {
  terminal: boolean;
  winnerTeam: number | null;
}

export function neutralizePlayer(room: Room, player: Player): boolean {
  if (player.isDead) return false;

  const gameMap = room.map;
  if (player.king && gameMap) {
    const kingBlock = gameMap.getBlock(player.king);
    if (kingBlock.player === player) kingBlock.kingBeDominated();
  }
  for (const block of player.land) {
    if (block.player === player) block.beNeutralized();
  }
  player.land.length = 0;
  player.king = null;
  player.isDead = true;
  return true;
}

export function cancelReconnectGrace(player: Player): void {
  if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
  player.disconnectTimer = null;
  player.disconnectGraceExpiresAt = null;
}

export function scheduleReconnectGrace(player: Player, onExpire: () => void, graceMs: number, now = Date.now()): void {
  cancelReconnectGrace(player);
  player.disconnected = true;
  player.disconnectGraceExpiresAt = now + graceMs;
  player.disconnectTimer = setTimeout(() => {
    player.disconnectTimer = null;
    player.disconnectGraceExpiresAt = null;
    onExpire();
  }, graceMs);
}

export function restoreConnectedPlayer(player: Player, socketId: string): void {
  cancelReconnectGrace(player);
  player.socket_id = socketId;
  player.disconnected = false;
}

export function getGameOutcome(room: Room): GameOutcome {
  const aliveTeams = new Set<number>();
  for (const player of room.players) {
    if (!player.isDead && !player.spectating()) aliveTeams.add(player.team);
  }
  if (aliveTeams.size > 1) return { terminal: false, winnerTeam: null };
  return {
    terminal: true,
    winnerTeam: aliveTeams.size === 1 ? aliveTeams.values().next().value : null,
  };
}

export function claimGameTermination(room: Room): boolean {
  if (!room.gameStarted) return false;
  room.gameStarted = false;
  return true;
}

export function cleanupFinishedRoom(room: Room): void {
  if (room.gameLoop) clearInterval(room.gameLoop);
  room.gameLoop = null;

  if (room.map) room.map.activeEffects.length = 0;
  const connectedPlayers = room.players.filter((player) => !player.disconnected);
  for (const player of room.players) cancelReconnectGrace(player);
  for (const player of connectedPlayers) {
    player.reset();
    player.disconnected = false;
  }

  room.players = connectedPlayers;
  room.gameStarted = false;
  room.forceStartNum = 0;
  room.mapGenerated = false;
  room.globalMapDiff = null;
  room.gameRecord = null;
  room.map = null;
  room.generals = [];
  room.codeforcesQueue = null;

  if (room.players.length > 0 && !room.players.some((player) => player.isRoomHost)) {
    room.players[0].setRoomHost(true);
  }
}
