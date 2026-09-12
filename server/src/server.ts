import express from 'express';
import { Request, Response } from 'express';
import { Server, Socket } from 'socket.io';
import xss from 'xss';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

import { ColorArr, MaxTeamNum, ReconnectGraceMs, forceStartOK } from './lib/constants';
import { roomPool, createRoom } from './lib/room-pool';
import {
  Room,
  initGameInfo,
  CustomMapData,
  MapDiffData,
  LeaderBoardTable,
  LeaderBoardRow,
  AbilityType,
  ABILITY_COSTS,
  CodeforcesChallengeState,
} from './lib/types';
import { getPlayerIndex, getPlayerIndexBySocket } from './lib/utils';
import Point from './lib/point';
import Player from './lib/player';
import GameMap from './lib/map';
import MapDiff from './lib/map-diff';
import GameRecord from './lib/game-record';
import { MathGenerator } from './lib/commander/math-generator';
import { addCommanderEnergy, COMMANDER_CONFIG } from './lib/commander/config';
import { CodeforcesCatalogueError, isValidCodeforcesHandle } from './lib/commander/codeforces-catalogue';
import { codeforcesApiQueue, CodeforcesApiError } from './lib/commander/cf-api-queue';
import SharedCodeforcesQueue from './lib/commander/shared-codeforces-queue';
import {
  cancelReconnectGrace,
  claimGameTermination,
  cleanupFinishedRoom,
  getGameOutcome,
  neutralizePlayer,
  restoreConnectedPlayer,
  scheduleReconnectGrace,
} from './lib/lifecycle';
import {
  applyRoomSetting,
  authorizeRoomSettingForSocket,
  changeTeamForSocket,
  isOrthogonalMove,
  MAX_SUPPORTED_PLAYERS,
  resolveSocketPlayer,
  surrenderForSocket,
} from './lib/security';
import { authorizeReconnect, createReconnectCredential } from './lib/session';

dotenv.config();

if (!process.env.CLIENT_URL || !process.env.PORT) {
  throw new Error('Please fill in `CLIENT_URL` and `PORT`.');
}

const prisma = new PrismaClient();
const app = express();
const cors_urls = process.env.CLIENT_URL == '*' ? '*' : process.env.CLIENT_URL.split(' ');
console.log(cors_urls);

app.use(express.json());
app.use(cors({ origin: cors_urls }));

app.get('/ping', (req: Request, res: Response) => {
  res.status(200).json('');
});

app.get('/get_rooms', (req: Request, res: Response) => {
  res.status(200).json(roomPool);
});

app.get('/create_room', async (req: Request, res: Response) => {
  const result = await createRoom();
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

app.get('/get_replay/:replayId', async (req: Request, res: Response) => {
  const replayId = req.params.replayId;
  const replayFilePath = path.join(process.cwd(), 'records', `${replayId}.json`);

  fs.readFile(replayFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      res.status(404).json({ error: 'Replay not found' });
    } else {
      try {
        const replayData = JSON.parse(data);
        res.status(200).json(replayData);
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to parse replay data' });
      }
    }
  });
});

app.get('/maps', async (req, res) => {
  const maps = await prisma.customMapData.findMany({
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      creator: true,
      description: true,
      createdAt: true,
      views: true,
      starCount: true,
    },
  });
  res.json(maps);
});

app.post('/maps', async (req, res) => {
  try {
    await prisma.customMapData.create({
      data: {
        ...req.body,
        mapTilesData: JSON.stringify(req.body.mapTilesData),
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

app.get('/maps/:id', async (req, res) => {
  const map = await prisma.customMapData.findUnique({
    where: { id: req.params.id },
  });
  if (!map) return res.status(404).end(); // Not Found
  await prisma.customMapData.update({
    where: { id: req.params.id },
    data: {
      views: {
        increment: 1,
      },
    },
  });
  map.mapTilesData = JSON.parse(map.mapTilesData);
  res.json(map);
});

app.put('/maps/:id', async (req, res) => {
  const updatedMap = await prisma.customMapData.update({
    where: { id: req.params.id },
    data: {
      ...req.body,
      mapTilesData: JSON.stringify(req.body.mapTilesData),
    },
  });
  res.json(updatedMap);
});

app.delete('/maps/:id', async (req, res) => {
  const deletedMap = await prisma.customMapData.delete({
    where: { id: req.params.id },
  });
  res.json(deletedMap);
});

app.get('/new', async (req, res) => {
  const newestMaps = await prisma.customMapData.findMany({
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      creator: true,
      description: true,
      createdAt: true,
      views: true,
      starCount: true,
    },
  });
  res.json(newestMaps);
});

app.get('/best', async (req, res) => {
  const bestMaps = await prisma.customMapData.findMany({
    orderBy: { starCount: 'desc' },
    take: 25,
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      creator: true,
      description: true,
      createdAt: true,
      views: true,
      starCount: true,
    },
  });
  res.json(bestMaps);
});

app.get('/hot', async (req, res) => {
  const hotMaps = await prisma.customMapData.findMany({
    orderBy: { views: 'desc' },
    take: 25,
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      creator: true,
      description: true,
      createdAt: true,
      views: true,
      starCount: true,
    },
  });
  res.json(hotMaps);
});

app.get('/search', async (req: Request, res: Response) => {
  const searchTerm = req.query.q;

  if (typeof searchTerm !== 'string') {
    res.status(400).json({ error: 'Invalid query parameter' });
    return;
  }

  const searchedMaps = await prisma.customMapData.findMany({
    where: {
      OR: [{ name: { contains: searchTerm } }, { id: { equals: searchTerm } }],
    },
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      creator: true,
      description: true,
      createdAt: true,
      views: true,
      starCount: true,
    },
  });
  res.json(searchedMaps);
});

app.post('/toggleStar', async (req: Request, res: Response) => {
  const { userId, mapId, action } = req.body;

  if (action !== 'increase' && action !== 'decrease') {
    res.status(400).json({ error: 'Invalid action' });
    return;
  }

  const existingStar = await prisma.starUsers.findUnique({
    where: { userId_mapId: { userId, mapId } },
  });

  if (action === 'increase') {
    if (existingStar) {
      res.status(400).json({ error: 'You have already starred this map' });
      return;
    }

    await prisma.$transaction([
      prisma.starUsers.create({ data: { userId, mapId } }),
      prisma.customMapData.update({ where: { id: mapId }, data: { starCount: { increment: 1 } } }),
    ]);
  } else {
    if (!existingStar) {
      res.status(400).json({ error: 'You have not starred this map yet' });
      return;
    }

    await prisma.$transaction([
      prisma.starUsers.delete({ where: { userId_mapId: { userId, mapId } } }),
      prisma.customMapData.update({ where: { id: mapId }, data: { starCount: { decrement: 1 } } }),
    ]);
  }

  res.json({ success: true });
});

app.get('/starredMaps', async (req, res) => {
  const userId = req.query.userId as string;

  if (!userId) {
    res.status(400).json({ error: 'User ID is required' });
    return;
  }

  const starredMaps = await prisma.starUsers.findMany({
    where: { userId },
    select: { mapId: true },
  });

  res.json(starredMaps.map((starUsers) => starUsers.mapId));
});

const server = app.listen(process.env.PORT, () => {
  console.log(`Application started on port ${process.env.PORT}!`);
});

const io = new Server(server, {
  cors: {
    origin: cors_urls,
  },
});

function getCodeforcesEligiblePlayers(room: Room): Player[] {
  return room.players.filter((candidate) => !candidate.isDead && !candidate.disconnected && !candidate.spectating());
}

function emitCodeforcesQueueStatus(room: Room, io: Server): void {
  const eligiblePlayers = getCodeforcesEligiblePlayers(room);
  const readyPlayerIds = eligiblePlayers
    .filter((candidate) => candidate.codeforcesSolvedSetReady)
    .map((candidate) => candidate.id);
  io.in(room.id).emit('codeforces_queue_status', {
    readyPlayers: readyPlayerIds.length,
    totalPlayers: eligiblePlayers.length,
    readyPlayerIds,
    initialized: room.codeforcesQueue !== null,
  });
}

function createCodeforcesAssignment(room: Room, player: Player, queuePosition: number): CodeforcesChallengeState | null {
  const queue = room.codeforcesQueue;
  if (!queue || !queue.hasPlayer(player.id)) return null;

  try {
    const problem = queue.getOrCreateProblem(queuePosition);
    const assignment: CodeforcesChallengeState = {
      id: crypto.randomUUID(),
      queuePosition,
      ...problem,
      rewardEnergy: COMMANDER_CONFIG.codeforces.energyReward,
      rewardTroops: COMMANDER_CONFIG.codeforces.troopReward,
      challengeIssuedAt: Date.now(),
      rewarded: false,
      verificationInProgress: false,
    };
    player.activeCodeforcesChallenge = assignment;
    return assignment;
  } catch (error) {
    player.activeCodeforcesChallenge = null;
    const message =
      error instanceof CodeforcesCatalogueError
        ? 'No more shared Codeforces problems are available in this challenge band.'
        : 'Unable to prepare the next shared Codeforces problem.';
    io.sockets.sockets.get(player.socket_id)?.emit('codeforces_queue_exhausted', { message });
    return null;
  }
}

function emitCodeforcesAssignment(player: Player, assignment: CodeforcesChallengeState | null): void {
  if (assignment) io.sockets.sockets.get(player.socket_id)?.emit('codeforces_challenge', assignment);
}

function tryInitializeCodeforcesQueue(room: Room, io: Server): void {
  if (room.codeforcesQueue) return;
  const eligiblePlayers = getCodeforcesEligiblePlayers(room);
  emitCodeforcesQueueStatus(room, io);
  if (eligiblePlayers.length === 0 || eligiblePlayers.some((candidate) => !candidate.codeforcesSolvedSetReady)) return;

  room.codeforcesQueue = new SharedCodeforcesQueue(
    eligiblePlayers.map((candidate) => candidate.id),
    eligiblePlayers.map((candidate) => candidate.codeforcesSolvedSet)
  );

  for (const eligiblePlayer of eligiblePlayers) {
    emitCodeforcesAssignment(eligiblePlayer, createCodeforcesAssignment(room, eligiblePlayer, 0));
  }
  emitCodeforcesQueueStatus(room, io);
  io.in(room.id).emit('update_room', room);
}

function issuePlayerSession(player: Player, socket: Socket): void {
  const credential = createReconnectCredential();
  player.sessionTokenHash = credential.tokenHash;
  socket.emit('player_session', { playerId: player.id, reconnectToken: credential.token });
  socket.emit('set_player_id', player.id);
}

function finishGame(room: Room, io: Server, gameRecord: GameRecord): boolean {
  if (!claimGameTermination(room)) return false;

  const outcome = getGameOutcome(room);
  const winners =
    outcome.winnerTeam === null
      ? []
      : room.players.filter((player) => player.team === outcome.winnerTeam).map((player) => player.minify(true));
  let replayLink = '';
  try {
    replayLink = gameRecord.outPutToJSON(process.cwd());
  } catch (error) {
    console.error('Failed to write game replay:', error);
  }

  io.in(room.id).emit('game_ended', winners, replayLink);
  cleanupFinishedRoom(room);
  io.in(room.id).emit('update_room', room);
  if (room.players.length === 0 && !room.keepAlive) delete roomPool[room.id];
  return true;
}

function handleDisconnectInRoom(room: Room, player: Player, socketId: string, io: Server): void {
  try {
    if (player.socket_id !== socketId) return;

    if (room.gameStarted && !player.spectating()) {
      player.socket_id = '';
      scheduleReconnectGrace(
        player,
        () => {
          const liveRoom = roomPool[room.id];
          const livePlayer = liveRoom?.players.find((candidate) => candidate.id === player.id);
          if (!liveRoom || !livePlayer || !livePlayer.disconnected) return;

          livePlayer.sessionTokenHash = '';
          if (liveRoom.gameStarted) {
            neutralizePlayer(liveRoom, livePlayer);
            io.in(liveRoom.id).emit('room_message', livePlayer.minify(), 'failed to reconnect and was eliminated.');
            if (!liveRoom.codeforcesQueue) tryInitializeCodeforcesQueue(liveRoom, io);
            const outcome = getGameOutcome(liveRoom);
            if (outcome.terminal && liveRoom.gameRecord) {
              finishGame(liveRoom, io, liveRoom.gameRecord);
            } else {
              io.in(liveRoom.id).emit('update_room', liveRoom);
            }
          }
        },
        ReconnectGraceMs
      );
      io.in(room.id).emit('room_message', player.minify(), `disconnected; ${ReconnectGraceMs / 1000}s to reconnect.`);
    } else {
      cancelReconnectGrace(player);
      room.players = room.players.filter((p) => p.id != player.id);
      room.forceStartNum = room.players.filter((candidate) => candidate.forceStart).length;
      if (room.players.length < 1 && !room.keepAlive) {
        delete roomPool[room.id];
      } else if (room.players[0] && !room.players.some((candidate) => candidate.isRoomHost)) {
        room.players[0].setRoomHost(true);
      }
    }
    if (room.gameStarted && !room.codeforcesQueue) tryInitializeCodeforcesQueue(room, io);
    io.in(room.id).emit('update_room', room);
  } catch (e: any) {
    console.error(JSON.stringify(e, ['message', 'arguments', 'type', 'name']));
    console.log(e.stack);
  }
}

async function checkForcedStart(room: Room, io: Server) {
  const forceStartNum = forceStartOK[room.players.filter((player) => !player.spectating()).length];

  if (!room.gameStarted && room.forceStartNum >= forceStartNum) {
    await handleGame(room, io);
  }
}

async function handleGame(room: Room, io: Server) {
  if (room.gameStarted === false) {
    room.codeforcesQueue = null;
    room.players.forEach((player) => {
      player.reset();
    });

    if (room.mapId) {
      const data = await prisma.customMapData.findUnique({
        where: { id: room.mapId },
      });
      if (!data) {
        throw new Error('Map not found');
      }
      console.log(`Start game with custom map ${room.mapId} ${data.name}`);

      const customMapData = {
        ...data,
        mapTilesData: JSON.parse(data.mapTilesData),
      };
      room.map = GameMap.from_custom_map(customMapData, room.players, room.revealKing);
    } else {
      const actualWidth = Math.ceil(Math.sqrt(room.players.length) * 5 + 12 * room.mapWidth);
      const actualHeight = Math.ceil(Math.sqrt(room.players.length) * 5 + 12 * room.mapHeight);
      room.map = new GameMap(
        'random_map_id',
        'random_map_name',
        actualWidth,
        actualHeight,
        room.mountain,
        room.city,
        room.swamp,
        room.players,
        room.revealKing
      );
      room.map.generate();

      console.log(`Start game with random map `);
    }
    room.mapGenerated = true;
    const gameMap = room.map;
    if (!gameMap) throw new Error('Game map was not initialized');
    const globalMapDiff = new MapDiff();
    const gameRecord = new GameRecord(room.players, gameMap.width, gameMap.height);
    room.globalMapDiff = globalMapDiff;
    room.gameRecord = gameRecord;

    // Now: Client can get map name / width / height !
    // todo 对于自定义地图，地图名称应该在游戏开始前获知，而不是开始时
    console.info(`Start game`);
    room.gameStarted = true;
    const intro_message = 'Chat is being recorded. Have fun!';
    gameRecord.addMessage({ turn: gameMap.turn, player: null, content: intro_message });
    io.in(room.id).emit('update_room', room);
    io.in(room.id).emit('room_message', null, intro_message);
    room.players.forEach((player) => {
      const player_socket = io.sockets.sockets.get(player.socket_id);
      if (player_socket) {
        const initGameInfo: initGameInfo = {
          king: player.king ? { x: player.king.x, y: player.king.y } : { x: 0, y: 0 }, // spectator's king is null
          mapWidth: gameMap.width,
          mapHeight: gameMap.height,
        };
        player_socket.emit('game_started', initGameInfo);
        player.patchView = new MapDiff();
      }
    });

    const updTime = 500 / room.gameSpeed;
    room.gameLoop = setInterval(async () => {
      try {
        if (!room.gameStarted) return;
        room.players.forEach((player) => {
          if (player.activeChallenge && player.activeChallenge.expiresAtTurn <= gameMap.turn) {
            player.activeChallenge = null;
            player.challengeCooldownUntilTurn = gameMap.turn + COMMANDER_CONFIG.math.cooldownTurns;
            const player_socket = io.sockets.sockets.get(player.socket_id);
            if (player_socket) {
              player_socket.emit('challenge_expired', { source: 'MATH', message: 'Math challenge expired.' });
            }
            io.in(room.id).emit('update_room', room);
          }

          if (!player.isDead && !player.spectating()) {
            const king = player.king;
            if (!king) {
              console.error(`Active player ${player.id} has no king`);
              neutralizePlayer(room, player);
              return;
            }
            const block = gameMap.getBlock(king);
            const blockPlayerIndex = getPlayerIndex(room, block.player?.id);
            if (blockPlayerIndex !== -1) {
              if (block.player !== player && player.isDead === false) {
                console.log(block.player.username, 'captured', player.username);
                io.in(room.id).emit('captured', block.player.minify(), player.minify());
                const player_socket = io.sockets.sockets.get(player.socket_id);
                if (player_socket) {
                  player_socket.emit('game_over', block.player.minify()); // captured by block.player
                }
                player.isDead = true;
                player.land.forEach((block) => {
                  gameMap.transferBlock(block, room.players[blockPlayerIndex]);
                  room.players[blockPlayerIndex].winLand(block);
                });
                gameMap.getBlock(king).kingBeDominated();
                player.land.length = 0;
                if (!room.codeforcesQueue) tryInitializeCodeforcesQueue(room, io);
              } else if (!player.disconnected && player.operatedTurn === 0 && player.operatedTurn + 160 <= gameMap.turn) {
                // if player is not operated for 160/2 turns, it will be neutralized
                neutralizePlayer(room, player);
                if (!room.codeforcesQueue) tryInitializeCodeforcesQueue(room, io);
                io.in(room.id).emit('room_message', player.minify(), 'surrendered');
              }
            }
          }
        });

        const leaderBoardData: LeaderBoardTable = room.players
          .filter((player) => !player.spectating())
          .map((player) => {
            const data = gameMap.getTotal(player);
            return [player.color, player.team, data.army, data.land] as LeaderBoardRow;
          });

        const room_sockets = await io.in(room.id).fetchSockets();
        if (!room.gameStarted) return;

        for (const socket of room_sockets) {
          if (!room.gameStarted) return;
          const playerIndex = getPlayerIndexBySocket(room, socket.id);
          const viewPlayer = room.players[playerIndex];
          const patchView = viewPlayer?.patchView;
          if (playerIndex !== -1 && patchView && !viewPlayer.disconnected) {
            if ((room.deathSpectator && viewPlayer.isDead) || !room.fogOfWar || viewPlayer.spectating()) {
              await patchView.patch(gameMap.map);
            } else {
              await patchView.patch(await gameMap.getViewPlayer(viewPlayer));
            }
            socket.emit('game_update', patchView.data, gameMap.turn, leaderBoardData);
          }
        }

        await globalMapDiff.patch(gameMap.map);
        if (!room.gameStarted) return;
        gameRecord.addGameUpdate(globalMapDiff.data, gameMap.turn, leaderBoardData);
        gameMap.updateTurn();
        gameMap.updateUnit();

        const outcome = getGameOutcome(room);
        if (outcome.terminal) finishGame(room, io, gameRecord);
      } catch (e: any) {
        console.error(JSON.stringify(e, ['message', 'arguments', 'type', 'name']));
        console.log(e.stack);
      }
    }, updTime);
  }
}

function reject_join(socket: Socket, msg: string) {
  socket.emit('reject_join', msg);
  socket.disconnect();
}

function get_query_param(params: any, key: string) {
  if (Array.isArray(params[key])) {
    return params[key][0];
  } else {
    return params[key];
  }
}

// =====================
// main
// =====================

io.on('connection', async (socket) => {
  // ====================================
  // init
  // ====================================
  let player: Player;

  console.log(`new ${socket.id} connected`);

  const params = socket.handshake.query;
  let username = String(get_query_param(params, 'username') || '');
  const roomId = String(get_query_param(params, 'roomId') || '');
  const claimedPlayerId = typeof socket.handshake.auth?.playerId === 'string' ? socket.handshake.auth.playerId : '';
  const reconnectToken = typeof socket.handshake.auth?.reconnectToken === 'string' ? socket.handshake.auth.reconnectToken : '';

  console.log(`new connect: ${username} ${roomId} ${claimedPlayerId || 'new-session'}`);

  // validate roomId and username
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(roomId)) {
    reject_join(socket, 'Room ID is invalid.');
    return;
  }
  username = xss(username);
  if (!username.length) {
    username = 'Anonymous';
  }
  if (!Object.prototype.hasOwnProperty.call(roomPool, roomId) && claimedPlayerId) {
    reject_join(socket, 'Session authentication failed or reconnect grace expired.');
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(roomPool, roomId)) {
    const createResult = await createRoom(roomId);
    if (!createResult.success) {
      reject_join(socket, createResult.message || 'Unable to create the room.');
      return;
    }
  }
  const room = roomPool[roomId];
  if (!room) {
    reject_join(socket, 'Unable to load the room.');
    return;
  }

  if (claimedPlayerId) {
    const reconnectingPlayer = room.players.find((candidate) => candidate.id === claimedPlayerId);
    if (!reconnectingPlayer) {
      reject_join(socket, 'Session authentication failed or reconnect grace expired.');
      return;
    }
    const activeSocketConnected = Boolean(
      reconnectingPlayer.socket_id && io.sockets.sockets.get(reconnectingPlayer.socket_id)?.connected
    );
    const authorization = authorizeReconnect(reconnectingPlayer, reconnectToken, activeSocketConnected);
    if (authorization.ok === false) {
      const message =
        authorization.reason === 'DUPLICATE_SESSION'
          ? 'This player session is already active on another connection.'
          : 'Session authentication failed or reconnect grace expired.';
      reject_join(socket, message);
      return;
    }

    player = reconnectingPlayer;
    restoreConnectedPlayer(player, socket.id);
    socket.join(room.id);
    issuePlayerSession(player, socket);
    io.in(room.id).emit('room_message', player.minify(), 'reconnected.');
    io.in(room.id).emit('update_room', room);

    if (room.gameStarted) {
      const gameMap = room.map;
      if (!gameMap) {
        reject_join(socket, 'The active room has no game map.');
        return;
      }
      const king = player.king;
      const initGameInfo: initGameInfo = {
        king: player.isDead || !king ? { x: 0, y: 0 } : { x: king.x, y: king.y },
        mapWidth: gameMap.width,
        mapHeight: gameMap.height,
      };
      socket.emit('game_started', initGameInfo);
      player.patchView = new MapDiff();
    }
  } else {
    if (room.players.length >= room.maxPlayers || room.players.length >= MAX_SUPPORTED_PLAYERS) {
      reject_join(socket, 'The room is full.');
      return;
    }
    const playerId = crypto
      .randomBytes(Math.ceil(10 / 2))
      .toString('hex')
      .slice(0, 10);

    const allColor = Array.from({ length: ColorArr.length }, (_, i) => i);
    const occupiedColor = room.players.map((player) => player.color);
    occupiedColor.push(0); // 0 is reserved for neutral block
    const availableColor = allColor.filter((color) => {
      return !occupiedColor.includes(color);
    });
    const playerColor = availableColor[0];

    const allTeam = Array.from({ length: MaxTeamNum }, (_, i) => i + 1);
    const occupiedTeam = room.players.map((player) => player.team);
    const availableTeam = allTeam.filter((team) => {
      return !occupiedTeam.includes(team);
    });
    const playerTeam = availableTeam[0];

    if (playerColor === undefined || playerTeam === undefined) {
      reject_join(socket, 'The room has reached the supported player limit.');
      return;
    }

    player = new Player(playerId, socket.id, username, playerColor, playerTeam);
    console.log(`Connect! Socket ${socket.id}, room ${roomId} name ${username} playerId ${playerId} color ${playerColor}`);

    if (room.players.length === 0) {
      player.setRoomHost(true);
    }

    socket.join(room.id);
    issuePlayerSession(player, socket);

    let message = 'joined the room.';

    if (room.gameStarted) {
      const gameMap = room.map;
      if (!gameMap) {
        reject_join(socket, 'The active room has no game map.');
        return;
      }
      player.setSpectate();
      const initGameInfo: initGameInfo = {
        king: { x: 0, y: 0 }, // spectator's king is null
        mapWidth: gameMap.width,
        mapHeight: gameMap.height,
      };
      socket.emit('game_started', initGameInfo);
      player.patchView = new MapDiff();
      message = 'joined as spectator.';
    }

    room.players.push(player);

    // broadcast new player message to room
    io.in(room.id).emit('room_message', player.minify(), message);
    io.in(room.id).emit('update_room', room);
    console.log(player.username, message);
  }

  // ====================================
  // set up socket event listeners
  // ====================================

  socket.on('get_room_info', async () => {
    socket.emit('update_room', room);
  });

  socket.on('set_team', (team: unknown) => {
    const result = changeTeamForSocket(room, socket.id, team);
    if (result.ok === false) {
      socket.emit('error', 'Unable to change team', result.message);
      return;
    }
    const actingPlayer = result.value;
    io.in(room.id).emit('update_room', room);
    io.in(room.id).emit(
      'room_message',
      actingPlayer.minify(),
      actingPlayer.spectating() ? 'became a spectator.' : `changed to team ${String(team)}.`
    );
    checkForcedStart(room, io);
  });

  socket.on('surrender', () => {
    const result = surrenderForSocket(room, socket.id);
    if (result.ok === false) {
      socket.emit('surrender_result', { status: 'REJECTED', code: result.code, message: result.message });
      socket.emit('error', 'Surrender failed', result.message);
      return;
    }
    const actingPlayer = result.value;
    console.log(`${actingPlayer.username} surrendered.`);
    if (!room.codeforcesQueue) tryInitializeCodeforcesQueue(room, io);
    socket.emit('surrender_result', { status: 'ACCEPTED' });
    io.in(room.id).emit('room_message', actingPlayer.minify(), 'surrendered');
    const outcome = getGameOutcome(room);
    if (outcome.terminal && room.gameRecord) finishGame(room, io, room.gameRecord);
    else io.in(room.id).emit('update_room', room);
  });

  socket.on('change_host', async (playerId) => {
    try {
      const actingPlayer = resolveSocketPlayer(room, socket.id);
      if (!actingPlayer?.isRoomHost) {
        throw new Error('You are not the room host.');
      }
      const currentHost = getPlayerIndex(room, actingPlayer.id);
      const newHost = getPlayerIndex(room, playerId);
      if (currentHost !== -1 && newHost !== -1) {
        room.players[currentHost].setRoomHost(false);
        room.players[newHost].setRoomHost(true);
        io.in(room.id).emit('update_room', room);
        io.in(room.id).emit('host_modification', actingPlayer.minify(), room.players[newHost]);
      } else {
        throw new Error('Target player not found.');
      }
    } catch (e: any) {
      socket.emit('error', 'Host modification failed', e.message);
    }
  });

  socket.on('change_room_setting', async (property: string, value: number | string | boolean) => {
    try {
      const authorization = authorizeRoomSettingForSocket(room, socket.id, property, value);
      if (authorization.ok === false) {
        socket.emit('error', 'Modification was failed', authorization.message);
        return;
      }

      const { player: actingPlayer, property: settingKey } = authorization.value;
      let settingValue = authorization.value.value;
      if (settingKey === 'roomName') settingValue = xss(settingValue as string);
      if (settingKey === 'mapId') {
        if (settingValue === '') {
          room.mapName = '';
        } else {
          const map = await prisma.customMapData.findUnique({
            where: { id: settingValue as string },
            select: { name: true },
          });
          const liveActor = resolveSocketPlayer(room, socket.id);
          if (!map || room.gameStarted || !liveActor?.isRoomHost) {
            socket.emit('error', 'Modification was failed', 'Map not found or room settings are locked.');
            return;
          }
          room.mapName = map.name;
        }
      }

      applyRoomSetting(room, settingKey, settingValue);
      io.in(room.id).emit('update_room', room);
      io.in(room.id).emit('room_message', actingPlayer.minify(), `changed ${property}.`);
    } catch (e: any) {
      console.error('change_room_setting failed:', e);
      socket.emit('error', 'Modification was failed', 'Unable to change that room setting.');
    }
  });

  socket.on('player_message', async (message) => {
    const actingPlayer = resolveSocketPlayer(room, socket.id);
    if (!actingPlayer) return;
    if (room.gameStarted && room.gameRecord && room.map) {
      room.gameRecord.addMessage({ turn: room.map.turn, player: actingPlayer.minify(), content: message });
    }
    io.in(room.id).emit('room_message', actingPlayer.minify(), ': ' + message);
  });

  socket.on('disconnect', async () => {
    handleDisconnectInRoom(room, player, socket.id, io);
    checkForcedStart(room, io); // check if game can start
  });

  socket.on('force_start', async () => {
    try {
      const actingPlayer = resolveSocketPlayer(room, socket.id);
      if (actingPlayer && !actingPlayer.spectating()) {
        if (actingPlayer.forceStart === true) {
          actingPlayer.forceStart = false;
          --room.forceStartNum;
        } else {
          actingPlayer.forceStart = true;
          ++room.forceStartNum;
        }
        io.in(room.id).emit('update_room', room);
      }

      checkForcedStart(room, io);
    } catch (e: any) {
      console.log(e.stack);
      console.error(JSON.stringify(e, ['message', 'arguments', 'type', 'name']));
    }
  });

  socket.on('attack', async (from: Point, to: Point, isHalf: boolean) => {
    try {
      const gameMap = room.map;
      if (!room.gameStarted || !gameMap) {
        socket.emit('attack_failure', from, to, 'The match is not active');
        return;
      }
      if (typeof isHalf !== 'boolean') {
        socket.emit('attack_failure', from, to, 'Invalid parameter type');
        return;
      }
      if (from.x < 0 || from.x >= gameMap.width || from.y < 0 || from.y >= gameMap.height) {
        socket.emit('attack_failure', from, to, 'Invalid starting point');
        return;
      }

      if (to.x < 0 || to.x >= gameMap.width || to.y < 0 || to.y >= gameMap.height) {
        socket.emit('attack_failure', from, to, 'Invalid ending point, out of map');
        return;
      }

      if (!isOrthogonalMove(from, to)) {
        socket.emit('attack_failure', from, to, 'Invalid ending point; movement must be orthogonally adjacent');
        return;
      }

      const actingPlayer = resolveSocketPlayer(room, socket.id);
      if (actingPlayer && !actingPlayer.isDead && !actingPlayer.spectating() && actingPlayer.king) {
        const canOperate = actingPlayer.operatedTurn < gameMap.turn;
        if (canOperate && gameMap.commendable(actingPlayer, from, to)) {
          if (isHalf) {
            gameMap.moveHalfMovableUnit(actingPlayer, from, to);
          } else {
            gameMap.moveAllMovableUnit(actingPlayer, from, to);
          }

          actingPlayer.operatedTurn = gameMap.turn;
          socket.emit('attack_success', from, to, gameMap.turn);
        } else {
          socket.emit(
            'attack_failure',
            from,
            to,
            `Invalid operation: ${actingPlayer.operatedTurn} ${gameMap.turn} ${gameMap.commendable(actingPlayer, from, to)}`
          );
        }
      }
    } catch (e: any) {
      console.log(e.stack);
      console.error(JSON.stringify(e, ['message', 'arguments', 'type', 'name']));
    }
  });

  // ==========================================
  // COMMANDER MODE ENDPOINTS
  // ==========================================

  socket.on('get_commander_config', () => {
    socket.emit('commander_config', {
      maxEnergy: COMMANDER_CONFIG.maxEnergy,
      mathRewards: COMMANDER_CONFIG.math.rewards,
      codeforcesReward: {
        energy: COMMANDER_CONFIG.codeforces.energyReward,
        troops: COMMANDER_CONFIG.codeforces.troopReward,
        difficulty: COMMANDER_CONFIG.codeforces.difficulty,
        clistBand: COMMANDER_CONFIG.codeforces.clistBand,
      },
      abilities: COMMANDER_CONFIG.abilities,
    });
  });

  socket.on('get_codeforces_queue_status', () => {
    if (room.gameStarted) emitCodeforcesQueueStatus(room, io);
  });

  const requestMathChallenge = () => {
    try {
      // Guard: game must be active
      if (!room || !room.gameStarted || !room.map) return;

      // Guard: find player by socket
      const currPlayer = room.players.find((p) => p.socket_id === socket.id);
      if (!currPlayer || currPlayer.isDead || currPlayer.spectating()) return;

      // Guard: no active challenge already
      if (currPlayer.activeChallenge) {
        socket.emit('challenge_error', { source: 'MATH', message: 'You already have an active Math challenge.' });
        return;
      }

      // Guard: challenge cooldown
      if (room.map.turn < currPlayer.challengeCooldownUntilTurn) {
        socket.emit('challenge_error', { source: 'MATH', message: 'Math systems are recharging. Please wait.' });
        return;
      }

      const challenge = MathGenerator.generateChallenge(room.map.turn);
      currPlayer.activeChallenge = challenge;

      // Send to client — NEVER include correctAnswer
      // Update operatedTurn to prevent AFK surrender
      currPlayer.operatedTurn = room.map.turn;
      socket.emit('math_challenge', {
        id: challenge.id,
        domain: challenge.domain,
        difficulty: challenge.difficulty,
        question: challenge.question,
        rewardEnergy: challenge.rewardEnergy,
        rewardTroops: challenge.rewardTroops,
        expiresAtTurn: challenge.expiresAtTurn,
      });
      io.in(room.id).emit('update_room', room);
    } catch (e) {
      console.error('request_challenge error:', e);
      socket.emit('challenge_error', { source: 'MATH', message: 'Unable to assign a Math challenge.' });
    }
  };

  socket.on('request_math_challenge', requestMathChallenge);
  socket.on('request_challenge', requestMathChallenge);

  const submitMathAnswer = (id: string, answer: string) => {
    try {
      if (!room || !room.gameStarted || !room.map) return;

      const currPlayer = room.players.find((p) => p.socket_id === socket.id);
      if (!currPlayer || currPlayer.isDead || currPlayer.spectating()) return;

      if (!currPlayer.activeChallenge || currPlayer.activeChallenge.id !== id) {
        socket.emit('math_result', { status: 'ERROR', message: 'No matching active Math challenge.' });
        return;
      }

      if (currPlayer.activeChallenge.attempted) {
        socket.emit('math_result', { status: 'ERROR', message: 'This Math challenge was already submitted.' });
        return;
      }

      if (typeof answer !== 'string' || !answer.trim() || answer.length > 80) {
        socket.emit('math_result', { status: 'ERROR', message: 'Enter a valid answer.' });
        return;
      }

      if (room.map.turn > currPlayer.activeChallenge.expiresAtTurn) {
        currPlayer.activeChallenge = null;
        currPlayer.challengeCooldownUntilTurn = room.map.turn + COMMANDER_CONFIG.math.cooldownTurns;
        socket.emit('math_result', { status: 'EXPIRED', message: 'Math challenge expired.' });
        return;
      }

      currPlayer.activeChallenge.attempted = true;
      const rewardEnergy = currPlayer.activeChallenge.rewardEnergy;
      const rewardTroops = currPlayer.activeChallenge.rewardTroops;

      if (MathGenerator.verifyAnswer(currPlayer.activeChallenge, answer)) {
        currPlayer.energy = addCommanderEnergy(currPlayer.energy, rewardEnergy);
        if (currPlayer.king) room.map.getBlock(currPlayer.king).unit += rewardTroops;
        currPlayer.activeChallenge = null;
        currPlayer.challengeCooldownUntilTurn = room.map.turn + COMMANDER_CONFIG.math.cooldownTurns;
        currPlayer.operatedTurn = room.map.turn;
        socket.emit('math_result', {
          status: 'SOLVED',
          energy: currPlayer.energy,
          rewardEnergy,
          rewardTroops,
          message: 'Tactical solution confirmed.',
        });
        socket.emit('energy_update', { energy: currPlayer.energy });
      } else {
        currPlayer.activeChallenge = null;
        currPlayer.challengeCooldownUntilTurn = room.map.turn + COMMANDER_CONFIG.math.cooldownTurns;
        currPlayer.operatedTurn = room.map.turn;
        socket.emit('math_result', {
          status: 'NOT_ACCEPTED',
          message: 'Incorrect answer. Request another challenge after cooldown.',
        });
      }
      io.in(room.id).emit('update_room', room);
    } catch (e) {
      console.error('submit_challenge error:', e);
      socket.emit('math_result', { status: 'ERROR', message: 'Unable to verify the Math answer.' });
    }
  };

  socket.on('submit_math_answer', submitMathAnswer);
  socket.on('submit_challenge', submitMathAnswer);

  socket.on('request_codeforces_challenge', async (payload?: { handle?: string }) => {
    if (!room.gameStarted || !room.map) return;
    const currPlayer = room.players.find((p) => p.socket_id === socket.id);
    if (!currPlayer || currPlayer.isDead || currPlayer.disconnected || currPlayer.spectating()) return;

    if (room.codeforcesQueue) {
      if (!room.codeforcesQueue.hasPlayer(currPlayer.id)) {
        socket.emit('challenge_error', { source: 'CODEFORCES', message: 'You are not part of this match queue.' });
        return;
      }
      if (currPlayer.activeCodeforcesChallenge) {
        socket.emit('codeforces_challenge', currPlayer.activeCodeforcesChallenge);
        return;
      }
      const queuePosition = room.codeforcesQueue.getPlayerPosition(currPlayer.id);
      if (queuePosition !== null) {
        emitCodeforcesAssignment(currPlayer, createCodeforcesAssignment(room, currPlayer, queuePosition));
      }
      return;
    }

    if (currPlayer.codeforcesHistoryLoading) {
      socket.emit('codeforces_challenge_pending', { message: 'Your solved history is already queued.' });
      return;
    }

    const handle = String(payload?.handle || currPlayer.codeforcesHandle || '').trim();
    if (!isValidCodeforcesHandle(handle)) {
      socket.emit('challenge_error', { source: 'CODEFORCES', message: 'Enter a valid Codeforces handle.' });
      return;
    }

    const normalizedHandle = handle.toLowerCase();
    if (currPlayer.codeforcesSolvedSetReady && currPlayer.codeforcesHandle.trim().toLowerCase() === normalizedHandle) {
      socket.emit('codeforces_history_ready', { handle: currPlayer.codeforcesHandle });
      emitCodeforcesQueueStatus(room, io);
      tryInitializeCodeforcesQueue(room, io);
      return;
    }
    const duplicateHandle = room.players.some(
      (candidate) => candidate.id !== currPlayer.id && candidate.codeforcesHandle.trim().toLowerCase() === normalizedHandle
    );
    if (duplicateHandle) {
      socket.emit('challenge_error', {
        source: 'CODEFORCES',
        message: 'This Codeforces handle is already registered by another player in this grid.',
      });
      return;
    }

    const playerId = currPlayer.id;
    const roomIdForRequest = room.id;
    currPlayer.codeforcesHandle = handle;
    currPlayer.codeforcesSolvedSet = new Set<string>();
    currPlayer.codeforcesSolvedSetReady = false;
    currPlayer.codeforcesHistoryLoading = true;
    socket.emit('codeforces_challenge_pending', { message: 'Fetching your solved history through the shared API queue…' });
    emitCodeforcesQueueStatus(room, io);

    try {
      const solvedSet = await codeforcesApiQueue.fetchSolvedSet(handle);

      const liveRoom = roomPool[roomIdForRequest];
      const livePlayer = liveRoom?.players.find((p) => p.id === playerId);
      if (!liveRoom?.gameStarted || !liveRoom.map || !livePlayer || livePlayer.codeforcesHandle !== handle) return;

      livePlayer.codeforcesHistoryLoading = false;
      if (livePlayer.isDead || livePlayer.disconnected || livePlayer.spectating()) {
        tryInitializeCodeforcesQueue(liveRoom, io);
        return;
      }
      livePlayer.codeforcesSolvedSet = solvedSet;
      livePlayer.codeforcesSolvedSetReady = true;
      livePlayer.operatedTurn = liveRoom.map.turn;
      io.sockets.sockets.get(livePlayer.socket_id)?.emit('codeforces_history_ready', { handle });
      tryInitializeCodeforcesQueue(liveRoom, io);
      io.in(liveRoom.id).emit('update_room', liveRoom);
    } catch (error) {
      const liveRoom = roomPool[roomIdForRequest];
      const livePlayer = liveRoom?.players.find((candidate) => candidate.id === playerId);
      if (livePlayer?.codeforcesHandle === handle) {
        livePlayer.codeforcesHandle = '';
        livePlayer.codeforcesSolvedSet = new Set<string>();
        livePlayer.codeforcesSolvedSetReady = false;
        livePlayer.codeforcesHistoryLoading = false;
      }
      const code = error instanceof CodeforcesApiError ? error.code : 'UNAVAILABLE';
      const message =
        code === 'INVALID_HANDLE'
          ? 'Codeforces handle not found. Check the spelling and try again.'
          : 'Codeforces is temporarily unavailable. Try again shortly.';
      io.sockets.sockets.get(livePlayer?.socket_id || socket.id)?.emit('challenge_error', {
        source: 'CODEFORCES',
        message,
      });
      if (liveRoom) {
        emitCodeforcesQueueStatus(liveRoom, io);
        io.in(liveRoom.id).emit('update_room', liveRoom);
      }
    }
  });

  socket.on('verify_codeforces_solution', (payload?: { contestId?: number; problemIndex?: string; queuePosition?: number }) => {
    if (!room.gameStarted || !room.map) {
      socket.emit('challenge_error', { source: 'CODEFORCES', message: 'The match is not active.' });
      return;
    }

    const currPlayer = room.players.find((candidate) => candidate.socket_id === socket.id);
    if (!currPlayer || currPlayer.isDead || currPlayer.disconnected || currPlayer.spectating()) {
      socket.emit('challenge_error', { source: 'CODEFORCES', message: 'This player cannot verify a challenge.' });
      return;
    }

    const assignment = currPlayer.activeCodeforcesChallenge;
    if (!assignment) {
      socket.emit('challenge_error', { source: 'CODEFORCES', message: 'No active Codeforces assignment.' });
      return;
    }
    const queuePosition = room.codeforcesQueue?.getPlayerPosition(currPlayer.id);
    if (
      queuePosition === null ||
      queuePosition === undefined ||
      queuePosition !== assignment.queuePosition ||
      payload?.contestId !== assignment.contestId ||
      payload?.problemIndex !== assignment.problemIndex ||
      (payload.queuePosition !== undefined && payload.queuePosition !== assignment.queuePosition)
    ) {
      socket.emit('challenge_error', {
        source: 'CODEFORCES',
        message: 'Verification must match the server-assigned problem.',
      });
      return;
    }
    if (assignment.rewarded) {
      socket.emit('codeforces_verification_result', {
        status: 'ALREADY_REWARDED',
        message: 'This challenge reward was already claimed.',
      });
      return;
    }
    if (assignment.verificationInProgress) {
      socket.emit('codeforces_verification_pending', { message: 'Verification is already queued.' });
      return;
    }

    const now = Date.now();
    const retryAfterMs = COMMANDER_CONFIG.codeforces.verificationCooldownMs - (now - currPlayer.lastCodeforcesVerificationAt);
    if (retryAfterMs > 0) {
      socket.emit('challenge_error', {
        source: 'CODEFORCES',
        message: `Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before verifying again.`,
      });
      return;
    }
    if (!currPlayer.codeforcesHandle || !isValidCodeforcesHandle(currPlayer.codeforcesHandle)) {
      socket.emit('challenge_error', { source: 'CODEFORCES', message: 'A valid Codeforces handle is required.' });
      return;
    }

    assignment.verificationInProgress = true;
    currPlayer.lastCodeforcesVerificationAt = now;
    const assignmentId = assignment.id;
    const playerId = currPlayer.id;
    const roomIdForVerification = room.id;
    const handle = currPlayer.codeforcesHandle;
    socket.emit('codeforces_verification_pending', { message: 'Checking Codeforces…' });

    void codeforcesApiQueue
      .verifySubmission(handle, assignment.contestId, assignment.problemIndex, assignment.challengeIssuedAt)
      .then((result) => {
        const liveRoom = roomPool[roomIdForVerification];
        const livePlayer = liveRoom?.players.find((candidate) => candidate.id === playerId);
        const liveAssignment = livePlayer?.activeCodeforcesChallenge;
        if (
          !liveRoom?.gameStarted ||
          !liveRoom.map ||
          !liveRoom.codeforcesQueue ||
          !livePlayer ||
          livePlayer.isDead ||
          livePlayer.disconnected ||
          !liveAssignment ||
          liveAssignment.id !== assignmentId ||
          liveRoom.codeforcesQueue.getPlayerPosition(playerId) !== liveAssignment.queuePosition
        )
          return;

        liveAssignment.verificationInProgress = false;
        const liveSocket = io.sockets.sockets.get(livePlayer.socket_id);

        if (result.status !== 'accepted') {
          const message =
            result.reason === 'old_submission'
              ? 'That solution predates this assignment. Submit a new accepted solution.'
              : result.reason === 'rejected'
              ? 'Not accepted yet. Keep solving this problem on Codeforces.'
              : 'No submission found yet. Submit on Codeforces, then verify again.';
          liveSocket?.emit('codeforces_verification_result', {
            status: 'NOT_ACCEPTED',
            reason: result.reason,
            message,
          });
          return;
        }

        if (livePlayer.rewardedCodeforcesSubmissionIds.includes(result.submissionId)) {
          liveSocket?.emit('codeforces_verification_result', {
            status: 'ALREADY_REWARDED',
            message: 'This submission has already been rewarded.',
          });
          return;
        }

        liveAssignment.rewarded = true;
        livePlayer.rewardedCodeforcesSubmissionIds.push(result.submissionId);
        const solvedKey = `${liveAssignment.contestId}-${liveAssignment.problemIndex}`;
        livePlayer.codeforcesSolvedSet.add(solvedKey);
        codeforcesApiQueue.markProblemSolved(livePlayer.codeforcesHandle, solvedKey);
        livePlayer.energy = addCommanderEnergy(livePlayer.energy, liveAssignment.rewardEnergy);
        if (livePlayer.king) liveRoom.map.getBlock(livePlayer.king).unit += liveAssignment.rewardTroops;
        livePlayer.operatedTurn = liveRoom.map.turn;
        const nextQueuePosition = liveRoom.codeforcesQueue.advancePlayer(livePlayer.id);
        const nextChallenge = createCodeforcesAssignment(liveRoom, livePlayer, nextQueuePosition);
        liveSocket?.emit('codeforces_verification_result', {
          status: 'ACCEPTED',
          energy: livePlayer.energy,
          rewardEnergy: liveAssignment.rewardEnergy,
          rewardTroops: liveAssignment.rewardTroops,
          completedQueuePosition: liveAssignment.queuePosition,
          nextChallenge,
          message: 'Accepted solution confirmed.',
        });
        liveSocket?.emit('energy_update', { energy: livePlayer.energy });
      })
      .catch((error) => {
        const liveRoom = roomPool[roomIdForVerification];
        const livePlayer = liveRoom?.players.find((candidate) => candidate.id === playerId);
        const liveAssignment = livePlayer?.activeCodeforcesChallenge;
        if (!livePlayer || !liveAssignment || liveAssignment.id !== assignmentId) return;

        liveAssignment.verificationInProgress = false;
        io.sockets.sockets.get(livePlayer.socket_id)?.emit('codeforces_verification_result', {
          status: 'ERROR',
          message: 'Codeforces verification is temporarily unavailable. Try again.',
        });
        console.warn('Codeforces verification failed:', error instanceof CodeforcesApiError ? error.code : 'UNAVAILABLE');
      });
  });

  socket.on('activate_ability', (abilityType: AbilityType, target?: Point) => {
    try {
      if (!room || !room.gameStarted || !room.map) return;

      const currPlayer = room.players.find((p) => p.socket_id === socket.id);
      if (!currPlayer || currPlayer.isDead || currPlayer.spectating()) return;

      // Validate ability type
      const enabledAbilities = [AbilityType.Scout, AbilityType.Reinforce, AbilityType.Airstrike];
      if (!enabledAbilities.includes(abilityType)) {
        socket.emit('ability_failed', 'Unknown ability.');
        return;
      }

      const cost = ABILITY_COSTS[abilityType];
      if (cost === undefined) {
        socket.emit('ability_failed', 'Unknown ability.');
        return;
      }

      // Validate BEFORE spending energy
      if (currPlayer.energy < cost) {
        socket.emit('ability_failed', `Not enough energy. Need ${cost}, have ${currPlayer.energy}.`);
        return;
      }

      // Targeted abilities require a valid target
      const targeted = enabledAbilities;
      if (targeted.includes(abilityType)) {
        if (!target) {
          socket.emit('ability_failed', 'This ability requires a target.');
          return;
        }
        if (!room.map.withinMap(target)) {
          socket.emit('ability_failed', 'Target is outside the map.');
          return;
        }
      }

      // Update operatedTurn to prevent AFK surrender
      currPlayer.operatedTurn = room.map.turn;

      // Apply effect (validate ownership where needed, THEN deduct energy)
      switch (abilityType) {
        case AbilityType.Scout:
          currPlayer.energy -= cost;
          // Add scout effect to map for 10 turns (5 seconds) with radius 3
          room.map.activeEffects.push({
            type: 'Scout',
            player: currPlayer,
            center: target!,
            radius: 3,
            expiresAtTurn: room.map.turn + 10,
          });
          socket.emit('ability_activated', { abilityType, energy: currPlayer.energy });
          // Broadcast map update so both clients see the same game state
          io.in(room.id).emit('update_room', room);
          break;

        case AbilityType.Reinforce: {
          const block = room.map.getBlock(target!);
          if (!block || !block.player || block.player.id !== currPlayer.id) {
            socket.emit('ability_failed', 'You must target your own territory.');
            return;
          }
          block.unit += 40;
          currPlayer.energy -= cost;
          socket.emit('ability_activated', { abilityType, energy: currPlayer.energy });
          io.in(room.id).emit('update_room', room);
          break;
        }

        case AbilityType.Airstrike: {
          const block = room.map.getBlock(target!);
          if (!block) {
            socket.emit('ability_failed', 'Invalid target.');
            return;
          }
          // Cannot target own tiles
          if (block.player && block.player.team === currPlayer.team) {
            socket.emit('ability_failed', 'Cannot airstrike your own territory.');
            return;
          }
          currPlayer.energy -= cost;
          room.map.activeEffects.push({
            type: AbilityType.Airstrike,
            player: currPlayer,
            center: target!,
            radius: 1, // Airstrike hits a 3x3 area (radius 1)
            expiresAtTurn: room.map.turn + 6, // ~3 seconds delay before impact
          });
          socket.emit('ability_activated', { abilityType, energy: currPlayer.energy });
          io.in(room.id).emit('update_room', room);
          break;
        }
      }
    } catch (e) {
      console.error('activate_ability error:', e);
    }
  });
});
